import {
  DEFAULT_CURRENCY,
  DEFAULT_TAX_RATE,
  DOC_STATUSES,
  INVOICE_LINE_SOURCES,
  type DocStatus,
} from '../../constants/finance.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import { findCustomerById } from '../../repositories/customers/customer.repository.js'
import { findContractById, listCharges } from '../../repositories/contracts/contract.repository.js'
import {
  allocateDocumentNumber,
  applyInvoiceCredit,
  findInvoiceLineBySource,
  insertInvoice,
  listAllocationsByInvoice,
  listFinanceStatusEvents,
  listInvoiceLines,
  listInvoices,
  recordFinanceStatusEvent,
  replaceInvoiceLines,
  transitionInvoice,
  updateInvoiceDraft as persistInvoiceDraft,
  type InvoiceRecord,
} from '../../repositories/finance/finance.repository.js'
import { emitAccountingSourceEvent } from '../../repositories/procurement/procurement.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess } from '../authorization/authorization.service.js'
import { canAccessContract } from '../contracts/contract-access.js'
import { canAccessCustomer } from '../customers/customer-access.js'
import {
  canAccessFinanceRecord,
  isOrganizationWide,
  loadAccessibleInvoice,
  resolveFinanceOrganization,
} from './finance-access.js'
import { assertDraftMutable, canTransitionDoc } from './finance-rules.js'
import { calculateInvoice, type InvoiceLineInput } from './invoice-calc.js'
import { toInvoiceDetail, toInvoiceResource } from './finance.mapper.js'

type LineBody = {
  description: string
  quantity: number
  unitPrice: string
  discountAmount?: string
  taxRatePercent?: string
  sourceType?: string
  sourceId?: string
  chargeId?: string
}

type CreateInvoiceBody = {
  organizationId?: string
  customerId: string
  contractId?: string
  currency?: string
  documentDate: Date
  dueDate: Date
  notes?: string
  lines: LineBody[]
  chargeIds?: string[]
}

type UpdateInvoiceBody = {
  customerId?: string
  contractId?: string | null
  currency?: string
  documentDate?: Date
  dueDate?: Date
  notes?: string | null
  lines?: LineBody[]
  chargeIds?: string[]
}

type ListQuery = {
  organizationId?: string
  search?: string
  status?: string
  paymentStatus?: string
  branchId?: string
  customerId?: string
  contractId?: string
  legalEntityId?: string
  currency?: string
  documentFrom?: Date
  documentTo?: Date
  dueFrom?: Date
  dueTo?: Date
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  limit?: number
}

function upperStatus(value?: string): DocStatus | undefined {
  if (!value) return undefined
  return value.toUpperCase() as DocStatus
}

async function audit(
  action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
  invoice: InvoiceRecord,
  actorUserId: string | undefined,
  meta: RequestMeta | undefined,
  metadata: Record<string, unknown>,
) {
  await recordAuditEvent({
    action,
    entityType: AUDIT_ENTITY_TYPES.INVOICE,
    entityId: invoice.id,
    actorUserId,
    organizationId: invoice.organizationId,
    branchId: invoice.branchId,
    metadata,
    meta,
  })
}

async function requireCustomer(ctx: AccessContext, customerId: string, organizationId: string) {
  const customer = await findCustomerById(customerId)
  if (!customer || customer.organizationId !== organizationId || !canAccessCustomer(ctx, customer)) {
    throw notFound('Customer was not found.')
  }
  return customer
}

async function requireContract(ctx: AccessContext, contractId: string, organizationId: string, customerId: string) {
  const contract = await findContractById(contractId)
  if (!contract || contract.organizationId !== organizationId || !canAccessContract(ctx, contract)) {
    throw notFound('Contract was not found.')
  }
  if (contract.customerId !== customerId) {
    throw invalidField('contractId', 'Contract does not belong to the selected customer.')
  }
  return contract
}

async function resolveLines(
  organizationId: string,
  contractId: string | undefined,
  lines: LineBody[] | undefined,
  chargeIds: string[] | undefined,
): Promise<InvoiceLineInput[]> {
  const resolved: InvoiceLineInput[] = []
  for (const line of lines ?? []) {
    const sourceType = (line.sourceType ?? INVOICE_LINE_SOURCES.MANUAL).toUpperCase()
    const sourceId = line.sourceId ?? line.chargeId
    if (sourceType === INVOICE_LINE_SOURCES.CONTRACT_CHARGE && sourceId) {
      const existing = await findInvoiceLineBySource(organizationId, sourceType, sourceId)
      if (existing) throw conflict('This contract charge is already on an invoice.')
    }
    resolved.push({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountAmount: line.discountAmount,
      taxRatePercent: line.taxRatePercent ?? DEFAULT_TAX_RATE,
      sourceType,
      sourceId,
    })
  }
  if (chargeIds?.length) {
    if (!contractId) throw invalidField('contractId', 'Contract is required when selecting charges.')
    const charges = await listCharges(contractId)
    for (const chargeId of chargeIds) {
      const charge = charges.find((row) => String(row._id) === chargeId)
      if (!charge) throw notFound('Contract charge was not found.')
      if (charge.supersededBy) throw invalidField('chargeIds', 'Superseded charges cannot be invoiced.')
      const sourceId = String(charge._id)
      const existing = await findInvoiceLineBySource(organizationId, INVOICE_LINE_SOURCES.CONTRACT_CHARGE, sourceId)
      if (existing) throw conflict('This contract charge is already on an invoice.')
      resolved.push({
        description: `${toPublicEnum(String(charge.kind))} charge`,
        quantity: Number(charge.quantityDays),
        unitPrice: String(charge.unitAmount),
        discountAmount: '0.00',
        taxRatePercent: DEFAULT_TAX_RATE,
        sourceType: INVOICE_LINE_SOURCES.CONTRACT_CHARGE,
        sourceId,
      })
    }
  }
  if (resolved.length === 0) throw invalidField('lines', 'At least one invoice line is required.')
  return resolved
}

async function detail(invoice: InvoiceRecord) {
  const [lines, history, allocations] = await Promise.all([
    listInvoiceLines(invoice.id),
    listFinanceStatusEvents('invoice', invoice.id),
    listAllocationsByInvoice(invoice.id),
  ])
  return toInvoiceDetail(invoice, lines, history as Array<Record<string, unknown>>, allocations as Array<Record<string, unknown>>)
}

export async function listInvoiceDirectory(ctx: AccessContext, query: ListQuery) {
  assertPermission(ctx, PERMISSIONS.INVOICE_VIEW)
  const organizationId = resolveFinanceOrganization(ctx, query.organizationId)
  if (query.branchId && !hasBranchAccess(ctx, query.branchId, organizationId)) {
    throw notFound('Branch was not found.')
  }
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listInvoices({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search,
    status: upperStatus(query.status),
    paymentStatus: query.paymentStatus?.toUpperCase() as 'UNPAID' | 'PARTIAL' | 'PAID' | undefined,
    branchId: query.branchId,
    customerId: query.customerId,
    contractId: query.contractId,
    legalEntityId: query.legalEntityId,
    currency: query.currency,
    documentFrom: query.documentFrom,
    documentTo: query.documentTo,
    dueFrom: query.dueFrom,
    dueTo: query.dueTo,
    sort: (query.sort as 'createdAt') ?? 'createdAt',
    order: query.order ?? 'desc',
  })
  return toPaginated(page.items.map(toInvoiceResource), pagination.page, pagination.limit, page.total)
}

export async function getInvoice(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.INVOICE_VIEW)
  return detail(await loadAccessibleInvoice(ctx, id))
}

export async function createInvoiceDraft(ctx: AccessContext, body: CreateInvoiceBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.INVOICE_CREATE)
  const organizationId = resolveFinanceOrganization(ctx, body.organizationId)
  const customer = await requireCustomer(ctx, body.customerId, organizationId)
  if (!canAccessFinanceRecord(ctx, {
    organizationId: customer.organizationId,
    branchId: customer.branchId,
    legalEntityId: customer.legalEntityId,
  })) {
    throw notFound('Customer was not found.')
  }
  let contractId = body.contractId
  if (contractId) {
    const contract = await requireContract(ctx, contractId, organizationId, customer.id)
    if (contract.branchId !== customer.branchId && !hasBranchAccess(ctx, contract.branchId, organizationId)) {
      throw notFound('Contract was not found.')
    }
  }
  if (body.dueDate.getTime() < body.documentDate.getTime()) {
    throw invalidField('dueDate', 'Due date must be on or after the invoice date.')
  }
  const lineInputs = await resolveLines(organizationId, contractId, body.lines, body.chargeIds)
  const totals = calculateInvoice(lineInputs, DEFAULT_TAX_RATE)
  const invoice = await insertInvoice({
    organizationId,
    legalEntityId: customer.legalEntityId,
    branchId: customer.branchId,
    customerId: customer.id,
    customerDisplayName: customer.displayName,
    contractId,
    currency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    documentDate: body.documentDate,
    dueDate: body.dueDate,
    status: DOC_STATUSES.DRAFT,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxableAmount: totals.taxableAmount,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    paidAmount: '0.00',
    creditedAmount: '0.00',
    outstandingAmount: totals.totalAmount,
    notes: body.notes,
    createdBy: ctx.userId,
  })
  await replaceInvoiceLines(
    invoice.id,
    organizationId,
    totals.lines.map((line, index) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountAmount: line.discountAmount,
      taxRatePercent: line.taxRatePercent,
      taxCode: line.taxCode,
      taxCodeId: line.taxCodeId,
      taxTreatment: line.taxTreatment,
      taxCategory: line.taxCategory,
      pricingMode: line.pricingMode,
      lineSubtotal: line.lineSubtotal,
      taxableAmount: line.taxableAmount,
      taxAmount: line.taxAmount,
      lineTotal: line.lineTotal,
      sourceType: line.sourceType ?? INVOICE_LINE_SOURCES.MANUAL,
      sourceId: line.sourceId,
      sortOrder: index,
    })),
  )
  await recordFinanceStatusEvent({
    entityType: 'invoice',
    entityId: invoice.id,
    organizationId,
    branchId: invoice.branchId,
    toStatus: DOC_STATUSES.DRAFT,
    reason: 'created',
    actorUserId: ctx.userId,
  })
  await audit(AUDIT_ACTIONS.INVOICE_CREATE, invoice, ctx.userId, meta, { status: DOC_STATUSES.DRAFT })
  return detail(invoice)
}

export async function updateInvoiceDraft(ctx: AccessContext, id: string, body: UpdateInvoiceBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.INVOICE_EDIT)
  const existing = await loadAccessibleInvoice(ctx, id)
  try {
    assertDraftMutable(existing.status)
  } catch {
    throw conflict('Posted financial documents cannot be edited.')
  }
  let customerId = body.customerId ?? existing.customerId
  let customerDisplayName = existing.customerDisplayName
  let legalEntityId = existing.legalEntityId
  let branchId = existing.branchId
  if (body.customerId) {
    const customer = await requireCustomer(ctx, body.customerId, existing.organizationId)
    customerId = customer.id
    customerDisplayName = customer.displayName
    legalEntityId = customer.legalEntityId
    branchId = customer.branchId
  }
  let contractId: string | null | undefined = body.contractId
  if (body.contractId) {
    await requireContract(ctx, body.contractId, existing.organizationId, customerId)
  }
  const documentDate = body.documentDate ?? existing.documentDate
  const dueDate = body.dueDate ?? existing.dueDate
  if (dueDate.getTime() < documentDate.getTime()) {
    throw invalidField('dueDate', 'Due date must be on or after the invoice date.')
  }
  const shouldRecalc = Boolean(body.lines || body.chargeIds)
  let totals = {
    subtotal: existing.subtotal,
    discountTotal: existing.discountTotal,
    taxableAmount: existing.taxableAmount,
    taxAmount: existing.taxAmount,
    totalAmount: existing.totalAmount,
    lines: [] as ReturnType<typeof calculateInvoice>['lines'],
  }
  if (shouldRecalc) {
    const lineInputs = await resolveLines(
      existing.organizationId,
      contractId === null ? undefined : (contractId ?? existing.contractId),
      body.lines,
      body.chargeIds,
    )
    totals = calculateInvoice(lineInputs, DEFAULT_TAX_RATE)
    await replaceInvoiceLines(
      existing.id,
      existing.organizationId,
      totals.lines.map((line, index) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        taxRatePercent: line.taxRatePercent,
        taxCode: line.taxCode,
        taxCodeId: line.taxCodeId,
        taxTreatment: line.taxTreatment,
        taxCategory: line.taxCategory,
        pricingMode: line.pricingMode,
        lineSubtotal: line.lineSubtotal,
        taxableAmount: line.taxableAmount,
        taxAmount: line.taxAmount,
        lineTotal: line.lineTotal,
        sourceType: line.sourceType ?? INVOICE_LINE_SOURCES.MANUAL,
        sourceId: line.sourceId,
        sortOrder: index,
      })),
    )
  }
  const updated = await persistInvoiceDraft(existing.id, DOC_STATUSES.DRAFT, {
    customerId,
    customerDisplayName,
    contractId: contractId === undefined ? existing.contractId : contractId,
    currency: body.currency?.toUpperCase(),
    documentDate,
    dueDate,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxableAmount: totals.taxableAmount,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    outstandingAmount: totals.totalAmount,
    notes: body.notes === undefined ? existing.notes : body.notes,
  })
  if (!updated) throw conflict('Invoice could not be updated.')
  void legalEntityId
  void branchId
  await audit(AUDIT_ACTIONS.INVOICE_UPDATE, updated, ctx.userId, meta, { status: DOC_STATUSES.DRAFT })
  return detail(updated)
}

export async function postInvoice(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.INVOICE_POST)
  const existing = await loadAccessibleInvoice(ctx, id)
  if (!canTransitionDoc(existing.status, DOC_STATUSES.POSTED)) {
    throw invalidField('status', `An invoice cannot move from ${toPublicEnum(existing.status)} to posted`)
  }
  const lines = await listInvoiceLines(existing.id)
  if (lines.length === 0) throw invalidField('lines', 'At least one invoice line is required before posting.')
  for (const line of lines) {
    if (line.sourceType === INVOICE_LINE_SOURCES.CONTRACT_CHARGE && line.sourceId) {
      const other = await findInvoiceLineBySource(existing.organizationId, line.sourceType, line.sourceId)
      if (other && other.invoiceId !== existing.id) {
        throw conflict('This contract charge is already on another invoice.')
      }
    }
  }
  const totals = calculateInvoice(
    lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountAmount: line.discountAmount,
      taxRatePercent: line.taxRatePercent,
      sourceType: line.sourceType,
      sourceId: line.sourceId,
    })),
    DEFAULT_TAX_RATE,
  )
  await persistInvoiceDraft(existing.id, DOC_STATUSES.DRAFT, {
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxableAmount: totals.taxableAmount,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    outstandingAmount: totals.totalAmount,
  })
  const documentNumber = await allocateDocumentNumber(existing.organizationId, 'invoice')
  const posted = await transitionInvoice(existing.id, DOC_STATUSES.DRAFT, DOC_STATUSES.POSTED, {
    actorUserId: ctx.userId,
    documentNumber,
  })
  if (!posted) throw conflict('Invoice was already posted or is no longer a draft.')
  await recordFinanceStatusEvent({
    entityType: 'invoice',
    entityId: posted.id,
    organizationId: posted.organizationId,
    branchId: posted.branchId,
    fromStatus: DOC_STATUSES.DRAFT,
    toStatus: DOC_STATUSES.POSTED,
    reason: 'posted',
    actorUserId: ctx.userId,
  })
  await audit(AUDIT_ACTIONS.INVOICE_POST, posted, ctx.userId, meta, {
    documentNumber,
    totalAmount: posted.totalAmount,
  })
  await emitAccountingSourceEvent({
    organizationId: posted.organizationId,
    eventType: 'invoice.posted',
    entityType: 'invoice',
    entityId: posted.id,
    idempotencyKey: `invoice.posted:${posted.id}`,
    payload: {
      invoiceId: posted.id,
      documentNumber: posted.documentNumber,
      legalEntityId: posted.legalEntityId,
      branchId: posted.branchId,
      customerId: posted.customerId,
      contractId: posted.contractId,
      amount: posted.totalAmount,
      currency: posted.currency,
      accountingDate: posted.postedAt?.toISOString?.() ?? new Date().toISOString(),
    },
  })
  const { recordInvoiceTaxSnapshots } = await import('../tax/tax-transaction.service.js')
  await recordInvoiceTaxSnapshots({
    id: posted.id,
    organizationId: posted.organizationId,
    legalEntityId: posted.legalEntityId,
    branchId: posted.branchId,
    documentNumber: posted.documentNumber,
    customerId: posted.customerId,
    customerDisplayName: posted.customerDisplayName,
    documentDate: posted.documentDate,
    currency: posted.currency,
    actorUserId: ctx.userId,
    lines: totals.lines.map((line) => ({
      taxCode: line.taxCode,
      taxCodeId: line.taxCodeId,
      taxRatePercent: line.taxRatePercent,
      taxTreatment: line.taxTreatment,
      taxableAmount: line.taxableAmount,
      taxAmount: line.taxAmount,
      lineTotal: line.lineTotal,
      pricingMode: line.pricingMode,
    })),
  })
  return detail(posted)
}

export async function voidInvoice(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.INVOICE_VOID)
  const existing = await loadAccessibleInvoice(ctx, id)
  if (!canTransitionDoc(existing.status, DOC_STATUSES.VOIDED)) {
    throw invalidField('status', `An invoice cannot move from ${toPublicEnum(existing.status)} to voided`)
  }
  const voided = await transitionInvoice(existing.id, existing.status, DOC_STATUSES.VOIDED, {
    actorUserId: ctx.userId,
  })
  if (!voided) throw conflict('Invoice could not be voided.')
  await recordFinanceStatusEvent({
    entityType: 'invoice',
    entityId: voided.id,
    organizationId: voided.organizationId,
    branchId: voided.branchId,
    fromStatus: existing.status,
    toStatus: DOC_STATUSES.VOIDED,
    reason,
    actorUserId: ctx.userId,
  })
  await audit(AUDIT_ACTIONS.INVOICE_VOID, voided, ctx.userId, meta, { reason })
  return detail(voided)
}

/** Used by credit-note posting to reduce outstanding without mutating posted totals. */
export async function applyPostedCredit(invoiceId: string, creditedAmount: string, outstandingAmount: string) {
  return applyInvoiceCredit(invoiceId, creditedAmount, outstandingAmount)
}
