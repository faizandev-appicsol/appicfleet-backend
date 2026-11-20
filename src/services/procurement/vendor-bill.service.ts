import {
  DEFAULT_CURRENCY,
  DEFAULT_TAX_RATE,
  VENDOR_BILL_STATUSES,
  type VendorBillStatus,
} from '../../constants/procurement.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import {
  allocateProcurementNumber,
  emitAccountingSourceEvent,
  findLpoById,
  incrementLpoLineBilled,
  insertVendorBill,
  listLpoLines,
  listStatusEvents,
  listVendorBillLines,
  listVendorBills,
  recordStatusEvent,
  replaceVendorBillLines,
  transitionVendorBill,
  type VendorBillRecord,
} from '../../repositories/procurement/procurement.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess } from '../authorization/authorization.service.js'
import { calculateInvoice } from '../finance/invoice-calc.js'
import {
  isOrganizationWide,
  loadAccessibleLpo,
  loadAccessibleVendorBill,
  resolveProcurementOrganization,
} from './procurement-access.js'
import {
  assertBillMutable,
  billPaymentStatus,
  canTransitionBill,
  matchBillAgainstLpo,
  remainingBillableQty,
} from './procurement-rules.js'
import { toVendorBillDetail, toVendorBillResource } from './procurement.mapper.js'
import { requireActiveVendor } from './vendor.service.js'

type BillLineBody = {
  description: string
  quantity: number
  unitPrice: string
  discountAmount?: string
  taxRatePercent?: string
  lpoLineId?: string
}

type CreateBillBody = {
  organizationId?: string
  vendorId: string
  vendorInvoiceNumber: string
  lpoId?: string
  workOrderId?: string
  billDate: Date
  dueDate: Date
  currency?: string
  notes?: string
  lines: BillLineBody[]
}

async function detail(bill: VendorBillRecord) {
  const [lines, history] = await Promise.all([
    listVendorBillLines(bill.id),
    listStatusEvents('vendor_bill', bill.id),
  ])
  return toVendorBillDetail(bill, lines as Array<Record<string, unknown>>, history as Array<Record<string, unknown>>)
}

export async function listVendorBillDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.VENDOR_BILL_VIEW)
  const organizationId = resolveProcurementOrganization(ctx, query.organizationId as string | undefined)
  if (query.branchId && !hasBranchAccess(ctx, String(query.branchId), organizationId)) {
    throw notFound('Branch was not found.')
  }
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listVendorBills({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search as string | undefined,
    status: query.status ? (String(query.status).toUpperCase() as VendorBillStatus) : undefined,
    vendorId: query.vendorId as string | undefined,
    lpoId: query.lpoId as string | undefined,
    branchId: query.branchId as string | undefined,
    paymentStatus: query.paymentStatus ? String(query.paymentStatus).toUpperCase() : undefined,
    billFrom: query.billFrom as Date | undefined,
    billTo: query.billTo as Date | undefined,
    sort: (query.sort as 'createdAt') ?? 'createdAt',
    order: (query.order as 'asc' | 'desc') ?? 'desc',
  })
  return toPaginated(page.items.map(toVendorBillResource), pagination.page, pagination.limit, page.total)
}

export async function getVendorBill(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.VENDOR_BILL_VIEW)
  return detail(await loadAccessibleVendorBill(ctx, id))
}

export async function createVendorBillDraft(ctx: AccessContext, body: CreateBillBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.VENDOR_BILL_CREATE)
  if (!body.lines?.length) throw invalidField('lines', 'At least one bill line is required.')
  const vendor = await requireActiveVendor(ctx, body.vendorId)
  let matchResult: string | undefined
  let remainingQtyOk = true

  if (body.lpoId) {
    const lpo = await loadAccessibleLpo(ctx, body.lpoId)
    if (!['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(lpo.status)) {
      throw conflict('Vendor bills require an approved or received LPO.')
    }
    const lpoLines = await listLpoLines(lpo.id)
    for (const line of body.lines) {
      if (!line.lpoLineId) continue
      const matched = lpoLines.find((row) => String(row._id) === line.lpoLineId)
      if (!matched) throw invalidField('lines', 'LPO line was not found on the selected LPO.')
      const remaining = remainingBillableQty(Number(matched.quantity), Number(matched.billedQuantity ?? 0))
      if (line.quantity > remaining) {
        remainingQtyOk = false
        throw conflict(`Billing quantity exceeds remaining LPO quantity (${remaining}).`)
      }
    }
    matchResult = matchBillAgainstLpo({
      lpoVendorId: lpo.vendorId,
      billVendorId: vendor.id,
      lpoCurrency: lpo.currency,
      billCurrency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
      lpoTotal: lpo.totalAmount,
      billTotal: '0.00',
      remainingQtyOk,
    })
  }

  const totals = calculateInvoice(
    body.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountAmount: line.discountAmount,
      taxRatePercent: line.taxRatePercent ?? DEFAULT_TAX_RATE,
    })),
    DEFAULT_TAX_RATE,
  )

  if (body.lpoId) {
    const lpo = await findLpoById(body.lpoId)
    if (lpo) {
      matchResult = matchBillAgainstLpo({
        lpoVendorId: lpo.vendorId,
        billVendorId: vendor.id,
        lpoCurrency: lpo.currency,
        billCurrency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
        lpoTotal: lpo.totalAmount,
        billTotal: totals.totalAmount,
        remainingQtyOk,
      })
      if (matchResult !== 'MATCH' && matchResult !== 'AMOUNT_MISMATCH') {
        throw conflict(`Vendor bill does not match LPO (${matchResult}).`)
      }
    }
  }

  const bill = await insertVendorBill({
    organizationId: vendor.organizationId,
    legalEntityId: vendor.legalEntityId,
    branchId: vendor.branchId,
    vendorId: vendor.id,
    vendorName: vendor.name,
    vendorInvoiceNumber: body.vendorInvoiceNumber.trim(),
    lpoId: body.lpoId,
    workOrderId: body.workOrderId,
    currency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    billDate: body.billDate,
    dueDate: body.dueDate,
    status: VENDOR_BILL_STATUSES.DRAFT,
    matchResult,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxableAmount: totals.taxableAmount,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    paidAmount: '0.00',
    outstandingAmount: totals.totalAmount,
    paymentStatus: billPaymentStatus(totals.totalAmount, '0.00'),
    notes: body.notes,
    createdBy: ctx.userId,
  })

  await replaceVendorBillLines(
    bill.id,
    bill.organizationId,
    totals.lines.map((line, index) => ({
      ...line,
      lpoLineId: body.lines[index]?.lpoLineId,
      sortOrder: index,
    })),
  )
  await recordStatusEvent({
    entityType: 'vendor_bill',
    entityId: bill.id,
    organizationId: bill.organizationId,
    branchId: bill.branchId,
    toStatus: VENDOR_BILL_STATUSES.DRAFT,
    reason: 'created',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.VENDOR_BILL_CREATE,
    entityType: AUDIT_ENTITY_TYPES.VENDOR_BILL,
    entityId: bill.id,
    actorUserId: ctx.userId,
    organizationId: bill.organizationId,
    branchId: bill.branchId,
    metadata: { matchResult, vendorInvoiceNumber: bill.vendorInvoiceNumber },
    meta,
  })
  return detail(bill)
}

export async function submitVendorBill(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.VENDOR_BILL_EDIT)
  const existing = await loadAccessibleVendorBill(ctx, id)
  if (!canTransitionBill(existing.status, VENDOR_BILL_STATUSES.PENDING_REVIEW)) {
    throw invalidField('status', `A vendor bill cannot move from ${toPublicEnum(existing.status)} to pending_review`)
  }
  if (existing.matchResult && existing.matchResult !== 'MATCH' && existing.matchResult !== 'AMOUNT_MISMATCH') {
    throw conflict('Resolve matching exceptions before submitting the vendor bill.')
  }
  const submitted = await transitionVendorBill(existing.id, VENDOR_BILL_STATUSES.DRAFT, VENDOR_BILL_STATUSES.PENDING_REVIEW, {})
  if (!submitted) throw conflict('Vendor bill could not be submitted.')
  await recordStatusEvent({
    entityType: 'vendor_bill',
    entityId: submitted.id,
    organizationId: submitted.organizationId,
    branchId: submitted.branchId,
    fromStatus: VENDOR_BILL_STATUSES.DRAFT,
    toStatus: VENDOR_BILL_STATUSES.PENDING_REVIEW,
    reason: 'submitted',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.VENDOR_BILL_SUBMIT,
    entityType: AUDIT_ENTITY_TYPES.VENDOR_BILL,
    entityId: submitted.id,
    actorUserId: ctx.userId,
    organizationId: submitted.organizationId,
    branchId: submitted.branchId,
    metadata: { matchResult: submitted.matchResult },
    meta,
  })
  return detail(submitted)
}

export async function approveVendorBill(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.VENDOR_BILL_APPROVE)
  const existing = await loadAccessibleVendorBill(ctx, id)
  if (!canTransitionBill(existing.status, VENDOR_BILL_STATUSES.APPROVED)) {
    throw invalidField('status', `A vendor bill cannot move from ${toPublicEnum(existing.status)} to approved`)
  }
  if (existing.createdBy === ctx.userId) {
    throw conflict('Requester cannot approve their own vendor bill.')
  }
  if (existing.matchResult === 'AMOUNT_MISMATCH') {
    throw conflict('Amount-mismatched bills require an explicit adjustment before approval.')
  }
  const documentNumber = existing.documentNumber ?? (await allocateProcurementNumber(existing.organizationId, 'vendor_bill'))
  const approved = await transitionVendorBill(existing.id, existing.status, VENDOR_BILL_STATUSES.APPROVED, {
    documentNumber,
    approvedBy: ctx.userId,
    approvedAt: new Date(),
  })
  if (!approved) throw conflict('Vendor bill could not be approved.')

  const lines = await listVendorBillLines(approved.id)
  for (const line of lines) {
    if (line.lpoLineId) {
      await incrementLpoLineBilled(String(line.lpoLineId), Number(line.quantity))
    }
  }

  await recordStatusEvent({
    entityType: 'vendor_bill',
    entityId: approved.id,
    organizationId: approved.organizationId,
    branchId: approved.branchId,
    fromStatus: existing.status,
    toStatus: VENDOR_BILL_STATUSES.APPROVED,
    reason: 'approved',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: approved.organizationId,
    eventType: 'vendor_bill.approved',
    entityType: 'vendor_bill',
    entityId: approved.id,
    idempotencyKey: `vendor_bill.approved:${approved.id}`,
    payload: {
      vendorBillId: approved.id,
      documentNumber,
      vendorId: approved.vendorId,
      totalAmount: approved.totalAmount,
      currency: approved.currency,
      lpoId: approved.lpoId,
    },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.VENDOR_BILL_APPROVE,
    entityType: AUDIT_ENTITY_TYPES.VENDOR_BILL,
    entityId: approved.id,
    actorUserId: ctx.userId,
    organizationId: approved.organizationId,
    branchId: approved.branchId,
    metadata: { documentNumber },
    meta,
  })
  return detail(approved)
}

export async function postVendorBill(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.VENDOR_BILL_POST)
  const existing = await loadAccessibleVendorBill(ctx, id)
  if (!canTransitionBill(existing.status, VENDOR_BILL_STATUSES.POSTED)) {
    throw invalidField('status', `A vendor bill cannot move from ${toPublicEnum(existing.status)} to posted`)
  }
  const posted = await transitionVendorBill(existing.id, VENDOR_BILL_STATUSES.APPROVED, VENDOR_BILL_STATUSES.POSTED, {
    postedBy: ctx.userId,
    postedAt: new Date(),
  })
  if (!posted) throw conflict('Vendor bill could not be posted.')
  await recordStatusEvent({
    entityType: 'vendor_bill',
    entityId: posted.id,
    organizationId: posted.organizationId,
    branchId: posted.branchId,
    fromStatus: VENDOR_BILL_STATUSES.APPROVED,
    toStatus: VENDOR_BILL_STATUSES.POSTED,
    reason: 'posted',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: posted.organizationId,
    eventType: 'vendor_bill.posted',
    entityType: 'vendor_bill',
    entityId: posted.id,
    idempotencyKey: `vendor_bill.posted:${posted.id}`,
    payload: {
      vendorBillId: posted.id,
      documentNumber: posted.documentNumber,
      vendorId: posted.vendorId,
      totalAmount: posted.totalAmount,
      currency: posted.currency,
    },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.VENDOR_BILL_POST,
    entityType: AUDIT_ENTITY_TYPES.VENDOR_BILL,
    entityId: posted.id,
    actorUserId: ctx.userId,
    organizationId: posted.organizationId,
    branchId: posted.branchId,
    metadata: { documentNumber: posted.documentNumber },
    meta,
  })
  return detail(posted)
}

export async function cancelVendorBill(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.VENDOR_BILL_EDIT)
  const existing = await loadAccessibleVendorBill(ctx, id)
  if (!canTransitionBill(existing.status, VENDOR_BILL_STATUSES.CANCELLED)) {
    throw invalidField('status', `A vendor bill cannot move from ${toPublicEnum(existing.status)} to cancelled`)
  }
  try {
    assertBillMutable(existing.status)
  } catch {
    /* draft or pending/approved cancellable via transition table */
  }
  const cancelled = await transitionVendorBill(existing.id, existing.status, VENDOR_BILL_STATUSES.CANCELLED, {})
  if (!cancelled) throw conflict('Vendor bill could not be cancelled.')
  await recordStatusEvent({
    entityType: 'vendor_bill',
    entityId: cancelled.id,
    organizationId: cancelled.organizationId,
    branchId: cancelled.branchId,
    fromStatus: existing.status,
    toStatus: VENDOR_BILL_STATUSES.CANCELLED,
    reason,
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.VENDOR_BILL_CANCEL,
    entityType: AUDIT_ENTITY_TYPES.VENDOR_BILL,
    entityId: cancelled.id,
    actorUserId: ctx.userId,
    organizationId: cancelled.organizationId,
    branchId: cancelled.branchId,
    metadata: { reason },
    meta,
  })
  return detail(cancelled)
}
