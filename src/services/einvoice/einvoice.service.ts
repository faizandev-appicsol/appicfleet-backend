import {
  EINVOICE_ENVIRONMENTS,
  EINVOICE_FAILURE_CLASSES,
  EINVOICE_PROVIDERS,
  EINVOICE_STATUSES,
  TAX_SOURCE_TYPES,
  type EInvoiceEnvironment,
} from '../../constants/tax.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { DOC_STATUSES } from '../../constants/finance.js'
import {
  countSubmissions,
  findEInvoiceBySource,
  findTaxConfiguration,
  insertEInvoiceDocument,
  insertEInvoiceSubmission,
  listEInvoiceSubmissions,
  listEInvoices,
  listTaxStatusEvents,
  recordTaxStatusEvent,
  transitionEInvoice,
} from '../../repositories/tax/tax.repository.js'
import { emitAccountingSourceEvent } from '../../repositories/procurement/procurement.repository.js'
import { listInvoiceLines } from '../../repositories/finance/finance.repository.js'
import type { AccessContext } from '../../types/access.js'
import type { RequestMeta } from '../../types/http.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { loadAccessibleInvoice } from '../finance/finance-access.js'
import { canTransitionEInvoice, isRetryableEInvoiceStatus } from '../tax/tax-rules.js'
import { loadAccessibleEInvoice, resolveTaxOrganization } from '../tax/tax-access.js'
import { toEInvoiceResource, toEInvoiceSubmissionResource } from '../tax/tax.mapper.js'
import { calculateTaxDocument } from '../tax/tax-calc.js'
import { getEInvoiceProvider, type InternalEInvoiceModel } from './einvoice-provider.js'
import { validateInternalEInvoice } from './einvoice-validation.js'

export async function listEInvoiceDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.EINVOICE_VIEW)
  const organizationId = resolveTaxOrganization(ctx, query.organizationId as string | undefined)
  const pagination = resolvePagination(query)
  const filter: Record<string, unknown> = { organizationId }
  if (query.legalEntityId) filter.legalEntityId = query.legalEntityId
  if (query.branchId) filter.branchId = query.branchId
  if (query.status) filter.status = String(query.status).toUpperCase()
  if (query.customerId) filter.customerId = query.customerId
  if (query.provider) filter.provider = String(query.provider).toUpperCase()
  if (typeof query.search === 'string' && query.search.trim()) {
    filter.documentNumber = new RegExp(query.search.trim(), 'i')
  }
  const page = await listEInvoices(filter, pagination.skip, pagination.take)
  return toPaginated(page.items.map(toEInvoiceResource), pagination.page, pagination.limit, page.total)
}

export async function getEInvoiceDetail(ctx: AccessContext, id: string) {
  const doc = await loadAccessibleEInvoice(ctx, id)
  const [submissions, history] = await Promise.all([
    listEInvoiceSubmissions(id),
    listTaxStatusEvents('einvoice', id),
  ])
  return {
    ...toEInvoiceResource(doc),
    submissions: submissions.map(toEInvoiceSubmissionResource),
    history: history.map((row) => ({
      id: String(row.id),
      fromStatus: row.fromStatus ? String(row.fromStatus).toLowerCase() : undefined,
      toStatus: String(row.toStatus).toLowerCase(),
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    })),
  }
}

async function buildInternalModel(invoice: {
  id: string
  documentNumber?: string
  documentDate: Date
  currency: string
  customerDisplayName: string
  legalEntityId: string
  organizationId: string
  taxableAmount: string
  taxAmount: string
  totalAmount: string
}): Promise<{ model: InternalEInvoiceModel; config: Record<string, unknown> | null }> {
  const lines = await listInvoiceLines(invoice.id)
  const calculated = calculateTaxDocument(
    lines.map((line) => ({
      description: String(line.description),
      quantity: Number(line.quantity),
      unitPrice: String(line.unitPrice),
      discountAmount: String(line.discountAmount ?? '0.00'),
      taxRatePercent: String(line.taxRatePercent ?? '0.00'),
      taxCode: line.taxCode ? String(line.taxCode) : undefined,
      taxTreatment: line.taxTreatment as never,
      pricingMode: line.pricingMode as never,
    })),
  )
  const config = await findTaxConfiguration(invoice.organizationId, invoice.legalEntityId)
  const model: InternalEInvoiceModel = {
    documentNumber: invoice.documentNumber ?? '',
    issueDate: invoice.documentDate.toISOString(),
    currency: invoice.currency,
    supplier: {
      name: config?.registeredName ? String(config.registeredName) : '',
      vatNumber: config?.vatRegistrationNumber ? String(config.vatRegistrationNumber) : undefined,
      address: config?.registeredAddress ? String(config.registeredAddress) : undefined,
    },
    customer: {
      name: invoice.customerDisplayName,
    },
    lines: calculated.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxableAmount: line.taxableAmount,
      taxRatePercent: line.taxRatePercent,
      taxAmount: line.taxAmount,
      lineTotal: line.lineTotal,
      taxCode: line.taxCode,
    })),
    taxSummary: calculated.summaryByCode.map((row) => ({
      taxCode: row.taxCode,
      taxRatePercent: row.taxRatePercent,
      taxableAmount: row.taxableAmount,
      taxAmount: row.taxAmount,
    })),
    totals: {
      taxableAmount: invoice.taxableAmount,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
    },
  }
  return { model, config }
}

export async function generateEInvoiceFromInvoice(ctx: AccessContext, invoiceId: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.EINVOICE_GENERATE)
  const invoice = await loadAccessibleInvoice(ctx, invoiceId)
  if (invoice.status !== DOC_STATUSES.POSTED) {
    throw invalidField('status', 'Only posted invoices can generate e-invoices.')
  }
  const existing = await findEInvoiceBySource(invoice.organizationId, TAX_SOURCE_TYPES.INVOICE, invoice.id)
  if (existing && ![EINVOICE_STATUSES.CANCELLED].includes(String(existing.status) as never)) {
    return toEInvoiceResource(existing)
  }

  const { model, config } = await buildInternalModel(invoice)
  const issues = validateInternalEInvoice(model, {
    vatRegistrationStatus: config ? String(config.vatRegistrationStatus) : undefined,
    vatRegistrationNumber: config?.vatRegistrationNumber ? String(config.vatRegistrationNumber) : undefined,
    invoiceStatus: invoice.status,
  })
  const status = issues.length ? EINVOICE_STATUSES.NOT_READY : EINVOICE_STATUSES.GENERATED
  const version = existing ? Number(existing.documentVersion) + 1 : 1
  const submissionIdempotencyKey = `einvoice:${invoice.organizationId}:INVOICE:${invoice.id}:v${version}`
  const created = await insertEInvoiceDocument({
    organizationId: invoice.organizationId,
    legalEntityId: invoice.legalEntityId,
    branchId: invoice.branchId,
    sourceType: TAX_SOURCE_TYPES.INVOICE,
    sourceId: invoice.id,
    documentNumber: invoice.documentNumber,
    customerId: invoice.customerId,
    customerDisplayName: invoice.customerDisplayName,
    issueDate: invoice.documentDate,
    currency: invoice.currency,
    taxableAmount: invoice.taxableAmount,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    status,
    provider: config?.einvoiceProvider ? String(config.einvoiceProvider) : EINVOICE_PROVIDERS.SANDBOX,
    environment: config?.einvoiceEnvironment ? String(config.einvoiceEnvironment) : EINVOICE_ENVIRONMENTS.SANDBOX,
    submissionIdempotencyKey,
    documentVersion: version,
    formatVersion: 'internal-v1',
    snapshot: model,
    payload: model,
    validationErrors: issues,
    createdBy: ctx.userId,
  })
  await recordTaxStatusEvent({
    entityType: 'einvoice',
    entityId: created.id,
    organizationId: invoice.organizationId,
    branchId: invoice.branchId,
    toStatus: status,
    reason: 'generated',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: invoice.organizationId,
    eventType: 'einvoice.generated',
    entityType: 'einvoice_document',
    entityId: created.id,
    idempotencyKey: `einvoice.generated:${created.id}`,
    payload: { einvoiceId: created.id, invoiceId: invoice.id, status },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.EINVOICE_GENERATE,
    entityType: AUDIT_ENTITY_TYPES.EINVOICE,
    entityId: created.id,
    actorUserId: ctx.userId,
    organizationId: invoice.organizationId,
    branchId: invoice.branchId,
    meta,
  })
  return toEInvoiceResource(created)
}

export async function submitEInvoice(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.EINVOICE_SUBMIT)
  const doc = await loadAccessibleEInvoice(ctx, id)
  if (![EINVOICE_STATUSES.GENERATED, EINVOICE_STATUSES.READY, EINVOICE_STATUSES.FAILED, EINVOICE_STATUSES.REJECTED].includes(String(doc.status) as never)) {
    throw invalidField('status', 'E-invoice is not eligible for submission.')
  }
  if (!canTransitionEInvoice(String(doc.status) as never, EINVOICE_STATUSES.VALIDATING) && String(doc.status) !== EINVOICE_STATUSES.FAILED && String(doc.status) !== EINVOICE_STATUSES.REJECTED) {
    if (!canTransitionEInvoice(String(doc.status) as never, EINVOICE_STATUSES.SUBMITTED)) {
      throw invalidField('status', 'Invalid e-invoice status transition.')
    }
  }

  const validating = await transitionEInvoice(
    id,
    [EINVOICE_STATUSES.GENERATED, EINVOICE_STATUSES.READY, EINVOICE_STATUSES.FAILED, EINVOICE_STATUSES.REJECTED],
    EINVOICE_STATUSES.VALIDATING,
    {},
  )
  if (!validating) throw conflict('E-invoice is already being processed.')

  const model = (doc.snapshot ?? doc.payload) as InternalEInvoiceModel
  const config = await findTaxConfiguration(String(doc.organizationId), String(doc.legalEntityId))
  const issues = validateInternalEInvoice(model, {
    vatRegistrationStatus: config ? String(config.vatRegistrationStatus) : undefined,
    vatRegistrationNumber: config?.vatRegistrationNumber ? String(config.vatRegistrationNumber) : undefined,
    invoiceStatus: 'POSTED',
  })
  if (issues.length) {
    const failed = await transitionEInvoice(id, [EINVOICE_STATUSES.VALIDATING], EINVOICE_STATUSES.NOT_READY, {
      validationErrors: issues,
      failureClass: EINVOICE_FAILURE_CLASSES.VALIDATION,
      failureReason: issues.map((i) => i.message).join('; '),
    })
    return toEInvoiceResource(failed!)
  }

  const environment = String(doc.environment ?? EINVOICE_ENVIRONMENTS.SANDBOX).toUpperCase() as EInvoiceEnvironment
  if (environment === EINVOICE_ENVIRONMENTS.PRODUCTION && process.env.NODE_ENV !== 'production') {
    throw invalidField('environment', 'Refusing PRODUCTION e-invoice submission outside production runtime.')
  }

  const provider = getEInvoiceProvider(doc.provider ? String(doc.provider) : undefined)
  const attemptNumber = (await countSubmissions(id)) + 1
  const requestIdempotencyKey = `${doc.submissionIdempotencyKey}:attempt:${attemptNumber}`

  await emitAccountingSourceEvent({
    organizationId: String(doc.organizationId),
    eventType: 'einvoice.submission.requested',
    entityType: 'einvoice_document',
    entityId: id,
    idempotencyKey: `einvoice.submission.requested:${id}:${attemptNumber}`,
    payload: { einvoiceId: id, attemptNumber },
  })

  const result = await provider.submitInvoice({
    document: model,
    idempotencyKey: String(doc.submissionIdempotencyKey),
    environment,
  })

  await insertEInvoiceSubmission({
    organizationId: doc.organizationId,
    einvoiceDocumentId: id,
    attemptNumber,
    provider: provider.name,
    environment,
    status: result.status,
    failureClass: result.failureClass,
    requestIdempotencyKey,
    providerReference: result.providerReference,
    responseCode: result.responseCode,
    responseMessage: result.responseMessage,
    responseBody: result.responseBody,
    actorUserId: ctx.userId,
  })

  const nextStatus =
    result.status === 'ACCEPTED'
      ? EINVOICE_STATUSES.ACCEPTED
      : result.status === 'REJECTED'
        ? EINVOICE_STATUSES.REJECTED
        : result.status === 'SUBMITTED'
          ? EINVOICE_STATUSES.SUBMITTED
          : EINVOICE_STATUSES.FAILED

  const updated = await transitionEInvoice(id, [EINVOICE_STATUSES.VALIDATING], nextStatus, {
    providerReference: result.providerReference,
    failureClass: result.failureClass ?? null,
    failureReason: result.success ? null : result.responseMessage,
    submittedAt: new Date(),
    ...(nextStatus === EINVOICE_STATUSES.ACCEPTED ? { acceptedAt: new Date() } : {}),
    ...(nextStatus === EINVOICE_STATUSES.REJECTED ? { rejectedAt: new Date() } : {}),
  })
  if (!updated) throw conflict('E-invoice status could not be updated after submission.')

  await recordTaxStatusEvent({
    entityType: 'einvoice',
    entityId: id,
    organizationId: doc.organizationId,
    branchId: doc.branchId,
    fromStatus: EINVOICE_STATUSES.VALIDATING,
    toStatus: nextStatus,
    reason: result.responseMessage,
    actorUserId: ctx.userId,
  })

  const eventType =
    nextStatus === EINVOICE_STATUSES.ACCEPTED
      ? 'einvoice.accepted'
      : nextStatus === EINVOICE_STATUSES.REJECTED
        ? 'einvoice.rejected'
        : nextStatus === EINVOICE_STATUSES.FAILED
          ? 'einvoice.failed'
          : 'einvoice.submitted'
  await emitAccountingSourceEvent({
    organizationId: String(doc.organizationId),
    eventType,
    entityType: 'einvoice_document',
    entityId: id,
    idempotencyKey: `${eventType}:${id}:${attemptNumber}`,
    payload: { einvoiceId: id, providerReference: result.providerReference, status: nextStatus },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.EINVOICE_SUBMIT,
    entityType: AUDIT_ENTITY_TYPES.EINVOICE,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: String(doc.organizationId),
    branchId: String(doc.branchId),
    meta,
    metadata: { status: nextStatus, providerReference: result.providerReference },
  })
  return toEInvoiceResource(updated)
}

export async function retryEInvoice(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.EINVOICE_RETRY)
  const doc = await loadAccessibleEInvoice(ctx, id)
  if (!isRetryableEInvoiceStatus(String(doc.status) as never)) {
    throw invalidField('status', 'E-invoice is not retryable.')
  }
  if (String(doc.failureClass) === EINVOICE_FAILURE_CLASSES.VALIDATION) {
    throw invalidField('status', 'Validation failures are not retryable until the document is corrected and regenerated.')
  }
  return submitEInvoice(ctx, id, meta)
}

export async function cancelEInvoice(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.EINVOICE_CANCEL)
  const doc = await loadAccessibleEInvoice(ctx, id)
  if (!canTransitionEInvoice(String(doc.status) as never, EINVOICE_STATUSES.CANCELLED)) {
    throw invalidField('status', 'E-invoice cannot be cancelled from its current status.')
  }
  const updated = await transitionEInvoice(
    id,
    [EINVOICE_STATUSES.NOT_READY, EINVOICE_STATUSES.READY, EINVOICE_STATUSES.GENERATED, EINVOICE_STATUSES.REJECTED, EINVOICE_STATUSES.FAILED],
    EINVOICE_STATUSES.CANCELLED,
    { cancelledAt: new Date(), failureReason: reason },
  )
  if (!updated) throw conflict('E-invoice could not be cancelled.')
  await recordTaxStatusEvent({
    entityType: 'einvoice',
    entityId: id,
    organizationId: doc.organizationId,
    branchId: doc.branchId,
    fromStatus: String(doc.status),
    toStatus: EINVOICE_STATUSES.CANCELLED,
    reason,
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.EINVOICE_CANCEL,
    entityType: AUDIT_ENTITY_TYPES.EINVOICE,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: String(doc.organizationId),
    meta,
    metadata: { reason },
  })
  return toEInvoiceResource(updated)
}
