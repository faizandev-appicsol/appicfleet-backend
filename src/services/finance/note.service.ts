import { DEFAULT_TAX_RATE, DOC_STATUSES, type DocStatus } from '../../constants/finance.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import {
  allocateDocumentNumber,
  insertCreditNote,
  insertDebitNote,
  listCreditNoteLines,
  listCreditNotes,
  listDebitNoteLines,
  listDebitNotes,
  listFinanceStatusEvents,
  recordFinanceStatusEvent,
  replaceCreditNoteLines,
  replaceDebitNoteLines,
  sumPostedCreditsForInvoice,
  transitionCreditNote,
  transitionDebitNote,
  updateCreditNoteDraft as persistCreditNoteDraft,
  updateDebitNoteDraft as persistDebitNoteDraft,
  type CreditNoteRecord,
  type DebitNoteRecord,
} from '../../repositories/finance/finance.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { addMoney, compareMoney, normalizeMoney, subtractMoney } from '../../utils/money.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess } from '../authorization/authorization.service.js'
import {
  isOrganizationWide,
  loadAccessibleCreditNote,
  loadAccessibleDebitNote,
  loadAccessibleInvoice,
  resolveFinanceOrganization,
} from './finance-access.js'
import { assertDraftMutable, canTransitionDoc, creditCapacity } from './finance-rules.js'
import { calculateInvoice, type InvoiceLineInput } from './invoice-calc.js'
import { applyPostedCredit } from './invoice.service.js'
import {
  toCreditNoteDetail,
  toCreditNoteResource,
  toDebitNoteDetail,
  toDebitNoteResource,
} from './finance.mapper.js'

type LineBody = {
  description: string
  quantity: number
  unitPrice: string
  discountAmount?: string
  taxRatePercent?: string
}

type CreateCreditBody = {
  organizationId?: string
  invoiceId: string
  documentDate: Date
  reason: string
  notes?: string
  lines: LineBody[]
}

type CreateDebitBody = {
  organizationId?: string
  invoiceId?: string
  customerId?: string
  contractId?: string
  documentDate: Date
  reason: string
  notes?: string
  lines: LineBody[]
}

type ListQuery = {
  organizationId?: string
  search?: string
  status?: string
  branchId?: string
  customerId?: string
  invoiceId?: string
  documentFrom?: Date
  documentTo?: Date
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  limit?: number
}

function upperStatus(value?: string): DocStatus | undefined {
  if (!value) return undefined
  return value.toUpperCase() as DocStatus
}

function toLineInputs(lines: LineBody[]): InvoiceLineInput[] {
  if (!lines.length) throw invalidField('lines', 'At least one line is required.')
  return lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount,
    taxRatePercent: line.taxRatePercent ?? DEFAULT_TAX_RATE,
  }))
}

async function creditDetail(note: CreditNoteRecord) {
  const [lines, history] = await Promise.all([
    listCreditNoteLines(note.id),
    listFinanceStatusEvents('credit_note', note.id),
  ])
  return toCreditNoteDetail(note, lines as Array<Record<string, unknown>>, history as Array<Record<string, unknown>>)
}

async function debitDetail(note: DebitNoteRecord) {
  const [lines, history] = await Promise.all([
    listDebitNoteLines(note.id),
    listFinanceStatusEvents('debit_note', note.id),
  ])
  return toDebitNoteDetail(note, lines as Array<Record<string, unknown>>, history as Array<Record<string, unknown>>)
}

export async function listCreditNoteDirectory(ctx: AccessContext, query: ListQuery) {
  assertPermission(ctx, PERMISSIONS.CREDIT_NOTE_VIEW)
  const organizationId = resolveFinanceOrganization(ctx, query.organizationId)
  if (query.branchId && !hasBranchAccess(ctx, query.branchId, organizationId)) throw notFound('Branch was not found.')
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listCreditNotes({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search,
    status: upperStatus(query.status),
    branchId: query.branchId,
    customerId: query.customerId,
    invoiceId: query.invoiceId,
    documentFrom: query.documentFrom,
    documentTo: query.documentTo,
    order: query.order ?? 'desc',
  })
  return toPaginated(page.items.map(toCreditNoteResource), pagination.page, pagination.limit, page.total)
}

export async function getCreditNote(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.CREDIT_NOTE_VIEW)
  return creditDetail(await loadAccessibleCreditNote(ctx, id))
}

export async function createCreditNoteDraft(ctx: AccessContext, body: CreateCreditBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.CREDIT_NOTE_CREATE)
  const invoice = await loadAccessibleInvoice(ctx, body.invoiceId)
  if (invoice.status !== DOC_STATUSES.POSTED) {
    throw invalidField('invoiceId', 'Credit notes require a posted invoice.')
  }
  const totals = calculateInvoice(toLineInputs(body.lines), DEFAULT_TAX_RATE)
  const already = await sumPostedCreditsForInvoice(invoice.id)
  const capacity = creditCapacity(invoice.totalAmount, already)
  if (compareMoney(totals.totalAmount, capacity) > 0) {
    throw invalidField('lines', `Credit total cannot exceed remaining invoice credit capacity (${capacity}).`)
  }
  const note = await insertCreditNote({
    organizationId: invoice.organizationId,
    legalEntityId: invoice.legalEntityId,
    branchId: invoice.branchId,
    customerId: invoice.customerId,
    customerDisplayName: invoice.customerDisplayName,
    invoiceId: invoice.id,
    contractId: invoice.contractId,
    currency: invoice.currency,
    documentDate: body.documentDate,
    reason: body.reason,
    status: DOC_STATUSES.DRAFT,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxableAmount: totals.taxableAmount,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    notes: body.notes,
    createdBy: ctx.userId,
  })
  await replaceCreditNoteLines(
    note.id,
    note.organizationId,
    totals.lines.map((line, index) => ({ ...line, sortOrder: index })),
  )
  await recordFinanceStatusEvent({
    entityType: 'credit_note',
    entityId: note.id,
    organizationId: note.organizationId,
    branchId: note.branchId,
    toStatus: DOC_STATUSES.DRAFT,
    reason: 'created',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.CREDIT_NOTE_CREATE,
    entityType: AUDIT_ENTITY_TYPES.CREDIT_NOTE,
    entityId: note.id,
    actorUserId: ctx.userId,
    organizationId: note.organizationId,
    branchId: note.branchId,
    metadata: { invoiceId: invoice.id, totalAmount: note.totalAmount },
    meta,
  })
  return creditDetail(note)
}

export async function updateCreditNoteDraft(
  ctx: AccessContext,
  id: string,
  body: { reason?: string; documentDate?: Date; notes?: string | null; lines?: LineBody[] },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.CREDIT_NOTE_CREATE)
  const existing = await loadAccessibleCreditNote(ctx, id)
  try {
    assertDraftMutable(existing.status)
  } catch {
    throw conflict('Posted financial documents cannot be edited.')
  }
  let totals = {
    subtotal: existing.subtotal,
    discountTotal: existing.discountTotal,
    taxableAmount: existing.taxableAmount,
    taxAmount: existing.taxAmount,
    totalAmount: existing.totalAmount,
  }
  if (body.lines) {
    const calculated = calculateInvoice(toLineInputs(body.lines), DEFAULT_TAX_RATE)
    const invoice = await loadAccessibleInvoice(ctx, existing.invoiceId)
    const already = await sumPostedCreditsForInvoice(invoice.id)
    const capacity = creditCapacity(invoice.totalAmount, already)
    if (compareMoney(calculated.totalAmount, capacity) > 0) {
      throw invalidField('lines', `Credit total cannot exceed remaining invoice credit capacity (${capacity}).`)
    }
    totals = calculated
    await replaceCreditNoteLines(
      existing.id,
      existing.organizationId,
      calculated.lines.map((line, index) => ({ ...line, sortOrder: index })),
    )
  }
  const updated = await persistCreditNoteDraft(existing.id, {
    reason: body.reason,
    documentDate: body.documentDate,
    notes: body.notes,
    ...totals,
  })
  if (!updated) throw conflict('Credit note could not be updated.')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.CREDIT_NOTE_CREATE,
    entityType: AUDIT_ENTITY_TYPES.CREDIT_NOTE,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    metadata: { updated: true },
    meta,
  })
  return creditDetail(updated)
}

export async function postCreditNote(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.CREDIT_NOTE_POST)
  const existing = await loadAccessibleCreditNote(ctx, id)
  if (!canTransitionDoc(existing.status, DOC_STATUSES.POSTED)) {
    throw invalidField('status', `A credit note cannot move from ${toPublicEnum(existing.status)} to posted`)
  }
  const invoice = await loadAccessibleInvoice(ctx, existing.invoiceId)
  const already = await sumPostedCreditsForInvoice(invoice.id)
  const capacity = creditCapacity(invoice.totalAmount, already)
  if (compareMoney(existing.totalAmount, capacity) > 0) {
    throw conflict(`Credit total exceeds remaining capacity (${capacity}).`)
  }
  const documentNumber = await allocateDocumentNumber(existing.organizationId, 'credit_note')
  const posted = await transitionCreditNote(existing.id, DOC_STATUSES.DRAFT, DOC_STATUSES.POSTED, {
    actorUserId: ctx.userId,
    documentNumber,
  })
  if (!posted) throw conflict('Credit note was already posted.')
  const newCredited = addMoney(normalizeMoney(invoice.creditedAmount || '0.00'), posted.totalAmount)
  const outstanding =
    compareMoney(invoice.outstandingAmount, posted.totalAmount) >= 0
      ? subtractMoney(invoice.outstandingAmount, posted.totalAmount)
      : '0.00'
  await applyPostedCredit(invoice.id, newCredited, outstanding)
  await recordFinanceStatusEvent({
    entityType: 'credit_note',
    entityId: posted.id,
    organizationId: posted.organizationId,
    branchId: posted.branchId,
    fromStatus: DOC_STATUSES.DRAFT,
    toStatus: DOC_STATUSES.POSTED,
    reason: 'posted',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.CREDIT_NOTE_POST,
    entityType: AUDIT_ENTITY_TYPES.CREDIT_NOTE,
    entityId: posted.id,
    actorUserId: ctx.userId,
    organizationId: posted.organizationId,
    branchId: posted.branchId,
    metadata: { documentNumber, invoiceId: invoice.id },
    meta,
  })
  const noteLines = await listCreditNoteLines(posted.id)
  const { recordTaxSnapshots } = await import('../tax/tax-transaction.service.js')
  await recordTaxSnapshots({
    organizationId: posted.organizationId,
    legalEntityId: posted.legalEntityId,
    branchId: posted.branchId,
    sourceType: 'CREDIT_NOTE',
    sourceId: posted.id,
    documentNumber: posted.documentNumber,
    customerId: posted.customerId,
    customerDisplayName: posted.customerDisplayName,
    transactionDate: posted.documentDate,
    currency: posted.currency,
    actorUserId: ctx.userId,
    lines: noteLines.map((line) => ({
      taxCode: String((line as { taxCode?: string }).taxCode ?? 'STANDARD'),
      taxRatePercent: String((line as { taxRatePercent?: string }).taxRatePercent ?? DEFAULT_TAX_RATE),
      taxTreatment: String((line as { taxTreatment?: string }).taxTreatment ?? 'STANDARD_RATED'),
      taxableAmount: String((line as { taxableAmount: string }).taxableAmount),
      taxAmount: String((line as { taxAmount: string }).taxAmount),
      grossAmount: String((line as { lineTotal: string }).lineTotal),
    })),
  })
  return creditDetail(posted)
}

export async function listDebitNoteDirectory(ctx: AccessContext, query: ListQuery) {
  assertPermission(ctx, PERMISSIONS.DEBIT_NOTE_VIEW)
  const organizationId = resolveFinanceOrganization(ctx, query.organizationId)
  if (query.branchId && !hasBranchAccess(ctx, query.branchId, organizationId)) throw notFound('Branch was not found.')
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listDebitNotes({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search,
    status: upperStatus(query.status),
    branchId: query.branchId,
    customerId: query.customerId,
    invoiceId: query.invoiceId,
    documentFrom: query.documentFrom,
    documentTo: query.documentTo,
    order: query.order ?? 'desc',
  })
  return toPaginated(page.items.map(toDebitNoteResource), pagination.page, pagination.limit, page.total)
}

export async function getDebitNote(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.DEBIT_NOTE_VIEW)
  return debitDetail(await loadAccessibleDebitNote(ctx, id))
}

export async function createDebitNoteDraft(ctx: AccessContext, body: CreateDebitBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.DEBIT_NOTE_CREATE)
  if (!body.invoiceId && !body.customerId) {
    throw invalidField('customerId', 'Provide an invoice or a customer.')
  }
  let organizationId = resolveFinanceOrganization(ctx, body.organizationId)
  let legalEntityId = ''
  let branchId = ''
  let customerId = body.customerId ?? ''
  let customerDisplayName = ''
  let currency = 'AED'
  let contractId = body.contractId
  let invoiceId = body.invoiceId
  if (body.invoiceId) {
    const invoice = await loadAccessibleInvoice(ctx, body.invoiceId)
    if (invoice.status !== DOC_STATUSES.POSTED) {
      throw invalidField('invoiceId', 'Debit notes that reference an invoice require a posted invoice.')
    }
    organizationId = invoice.organizationId
    legalEntityId = invoice.legalEntityId
    branchId = invoice.branchId
    customerId = invoice.customerId
    customerDisplayName = invoice.customerDisplayName
    currency = invoice.currency
    contractId = invoice.contractId
    invoiceId = invoice.id
  } else {
    const { findCustomerById } = await import('../../repositories/customers/customer.repository.js')
    const { canAccessCustomer } = await import('../customers/customer-access.js')
    const customer = await findCustomerById(body.customerId!)
    if (!customer || customer.organizationId !== organizationId || !canAccessCustomer(ctx, customer)) {
      throw notFound('Customer was not found.')
    }
    legalEntityId = customer.legalEntityId
    branchId = customer.branchId
    customerId = customer.id
    customerDisplayName = customer.displayName
  }
  const totals = calculateInvoice(toLineInputs(body.lines), DEFAULT_TAX_RATE)
  const note = await insertDebitNote({
    organizationId,
    legalEntityId,
    branchId,
    customerId,
    customerDisplayName,
    invoiceId,
    contractId,
    currency,
    documentDate: body.documentDate,
    reason: body.reason,
    status: DOC_STATUSES.DRAFT,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxableAmount: totals.taxableAmount,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    notes: body.notes,
    createdBy: ctx.userId,
  })
  await replaceDebitNoteLines(
    note.id,
    note.organizationId,
    totals.lines.map((line, index) => ({ ...line, sortOrder: index })),
  )
  await recordFinanceStatusEvent({
    entityType: 'debit_note',
    entityId: note.id,
    organizationId: note.organizationId,
    branchId: note.branchId,
    toStatus: DOC_STATUSES.DRAFT,
    reason: 'created',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.DEBIT_NOTE_CREATE,
    entityType: AUDIT_ENTITY_TYPES.DEBIT_NOTE,
    entityId: note.id,
    actorUserId: ctx.userId,
    organizationId: note.organizationId,
    branchId: note.branchId,
    metadata: { totalAmount: note.totalAmount },
    meta,
  })
  return debitDetail(note)
}

export async function updateDebitNoteDraft(
  ctx: AccessContext,
  id: string,
  body: { reason?: string; documentDate?: Date; notes?: string | null; lines?: LineBody[] },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.DEBIT_NOTE_CREATE)
  const existing = await loadAccessibleDebitNote(ctx, id)
  try {
    assertDraftMutable(existing.status)
  } catch {
    throw conflict('Posted financial documents cannot be edited.')
  }
  let totals = {
    subtotal: existing.subtotal,
    discountTotal: existing.discountTotal,
    taxableAmount: existing.taxableAmount,
    taxAmount: existing.taxAmount,
    totalAmount: existing.totalAmount,
  }
  if (body.lines) {
    const calculated = calculateInvoice(toLineInputs(body.lines), DEFAULT_TAX_RATE)
    totals = calculated
    await replaceDebitNoteLines(
      existing.id,
      existing.organizationId,
      calculated.lines.map((line, index) => ({ ...line, sortOrder: index })),
    )
  }
  const updated = await persistDebitNoteDraft(existing.id, {
    reason: body.reason,
    documentDate: body.documentDate,
    notes: body.notes,
    ...totals,
  })
  if (!updated) throw conflict('Debit note could not be updated.')
  void meta
  return debitDetail(updated)
}

export async function postDebitNote(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.DEBIT_NOTE_POST)
  const existing = await loadAccessibleDebitNote(ctx, id)
  if (!canTransitionDoc(existing.status, DOC_STATUSES.POSTED)) {
    throw invalidField('status', `A debit note cannot move from ${toPublicEnum(existing.status)} to posted`)
  }
  const documentNumber = await allocateDocumentNumber(existing.organizationId, 'debit_note')
  const posted = await transitionDebitNote(existing.id, DOC_STATUSES.DRAFT, DOC_STATUSES.POSTED, {
    actorUserId: ctx.userId,
    documentNumber,
  })
  if (!posted) throw conflict('Debit note was already posted.')
  await recordFinanceStatusEvent({
    entityType: 'debit_note',
    entityId: posted.id,
    organizationId: posted.organizationId,
    branchId: posted.branchId,
    fromStatus: DOC_STATUSES.DRAFT,
    toStatus: DOC_STATUSES.POSTED,
    reason: 'posted',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.DEBIT_NOTE_POST,
    entityType: AUDIT_ENTITY_TYPES.DEBIT_NOTE,
    entityId: posted.id,
    actorUserId: ctx.userId,
    organizationId: posted.organizationId,
    branchId: posted.branchId,
    metadata: { documentNumber },
    meta,
  })
  const noteLines = await listDebitNoteLines(posted.id)
  const { recordTaxSnapshots } = await import('../tax/tax-transaction.service.js')
  await recordTaxSnapshots({
    organizationId: posted.organizationId,
    legalEntityId: posted.legalEntityId,
    branchId: posted.branchId,
    sourceType: 'DEBIT_NOTE',
    sourceId: posted.id,
    documentNumber: posted.documentNumber,
    customerId: posted.customerId,
    customerDisplayName: posted.customerDisplayName,
    transactionDate: posted.documentDate,
    currency: posted.currency,
    actorUserId: ctx.userId,
    lines: noteLines.map((line) => ({
      taxCode: String((line as { taxCode?: string }).taxCode ?? 'STANDARD'),
      taxRatePercent: String((line as { taxRatePercent?: string }).taxRatePercent ?? DEFAULT_TAX_RATE),
      taxTreatment: String((line as { taxTreatment?: string }).taxTreatment ?? 'STANDARD_RATED'),
      taxableAmount: String((line as { taxableAmount: string }).taxableAmount),
      taxAmount: String((line as { taxAmount: string }).taxAmount),
      grossAmount: String((line as { lineTotal: string }).lineTotal),
    })),
  })
  return debitDetail(posted)
}
