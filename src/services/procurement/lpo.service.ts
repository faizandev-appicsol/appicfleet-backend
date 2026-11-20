import {
  DEFAULT_CURRENCY,
  DEFAULT_TAX_RATE,
  LPO_STATUSES,
  type LpoStatus,
} from '../../constants/procurement.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import {
  allocateProcurementNumber,
  emitAccountingSourceEvent,
  insertLpo,
  listLpoLines,
  listLpos,
  listStatusEvents,
  recordStatusEvent,
  replaceLpoLines,
  transitionLpo,
  updateLpoDraft,
  type LpoRecord,
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
  resolveProcurementOrganization,
} from './procurement-access.js'
import { approvalLevelForAmount, assertLpoMutable, canTransitionLpo } from './procurement-rules.js'
import { toLpoDetail, toLpoResource } from './procurement.mapper.js'
import { requireActiveVendor } from './vendor.service.js'

type LineBody = {
  description: string
  quantity: number
  unitPrice: string
  discountAmount?: string
  taxRatePercent?: string
  vehicleId?: string
  notes?: string
}

type CreateLpoBody = {
  organizationId?: string
  vendorId: string
  orderDate: Date
  expectedAt?: Date
  currency?: string
  paymentTerms?: string
  notes?: string
  workOrderId?: string
  lines: LineBody[]
}

async function detail(lpo: LpoRecord) {
  const [lines, history] = await Promise.all([listLpoLines(lpo.id), listStatusEvents('lpo', lpo.id)])
  return toLpoDetail(lpo, lines as Array<Record<string, unknown>>, history as Array<Record<string, unknown>>)
}

export async function listLpoDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.LPO_VIEW)
  const organizationId = resolveProcurementOrganization(ctx, query.organizationId as string | undefined)
  if (query.branchId && !hasBranchAccess(ctx, String(query.branchId), organizationId)) {
    throw notFound('Branch was not found.')
  }
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listLpos({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search as string | undefined,
    status: query.status ? (String(query.status).toUpperCase() as LpoStatus) : undefined,
    vendorId: query.vendorId as string | undefined,
    branchId: query.branchId as string | undefined,
    orderFrom: query.orderFrom as Date | undefined,
    orderTo: query.orderTo as Date | undefined,
    sort: (query.sort as 'createdAt') ?? 'createdAt',
    order: (query.order as 'asc' | 'desc') ?? 'desc',
  })
  return toPaginated(page.items.map(toLpoResource), pagination.page, pagination.limit, page.total)
}

export async function getLpo(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.LPO_VIEW)
  return detail(await loadAccessibleLpo(ctx, id))
}

export async function createLpoDraft(ctx: AccessContext, body: CreateLpoBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.LPO_CREATE)
  const vendor = await requireActiveVendor(ctx, body.vendorId)
  if (!body.lines?.length) throw invalidField('lines', 'At least one LPO line is required.')
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
  const lpo = await insertLpo({
    organizationId: vendor.organizationId,
    legalEntityId: vendor.legalEntityId,
    branchId: vendor.branchId,
    vendorId: vendor.id,
    vendorName: vendor.name,
    orderDate: body.orderDate,
    expectedAt: body.expectedAt,
    currency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    paymentTerms: (body.paymentTerms ?? vendor.paymentTerms).toUpperCase(),
    status: LPO_STATUSES.DRAFT,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxableAmount: totals.taxableAmount,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    approvalLevel: approvalLevelForAmount(totals.totalAmount),
    notes: body.notes,
    workOrderId: body.workOrderId,
    createdBy: ctx.userId,
  })
  await replaceLpoLines(
    lpo.id,
    lpo.organizationId,
    totals.lines.map((line, index) => ({
      ...line,
      vehicleId: body.lines[index]?.vehicleId,
      notes: body.lines[index]?.notes,
      sortOrder: index,
    })),
  )
  await recordStatusEvent({
    entityType: 'lpo',
    entityId: lpo.id,
    organizationId: lpo.organizationId,
    branchId: lpo.branchId,
    toStatus: LPO_STATUSES.DRAFT,
    reason: 'created',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.LPO_CREATE,
    entityType: AUDIT_ENTITY_TYPES.LPO,
    entityId: lpo.id,
    actorUserId: ctx.userId,
    organizationId: lpo.organizationId,
    branchId: lpo.branchId,
    metadata: { totalAmount: lpo.totalAmount },
    meta,
  })
  return detail(lpo)
}

export async function updateLpo(ctx: AccessContext, id: string, body: Partial<CreateLpoBody>, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.LPO_EDIT)
  const existing = await loadAccessibleLpo(ctx, id)
  try {
    assertLpoMutable(existing.status)
  } catch {
    throw conflict('Only draft LPOs can be edited.')
  }
  let vendorId = existing.vendorId
  let vendorName = existing.vendorName
  if (body.vendorId) {
    const vendor = await requireActiveVendor(ctx, body.vendorId)
    vendorId = vendor.id
    vendorName = vendor.name
  }
  let totals = {
    subtotal: existing.subtotal,
    discountTotal: existing.discountTotal,
    taxableAmount: existing.taxableAmount,
    taxAmount: existing.taxAmount,
    totalAmount: existing.totalAmount,
  }
  if (body.lines) {
    const calculated = calculateInvoice(
      body.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        taxRatePercent: line.taxRatePercent ?? DEFAULT_TAX_RATE,
      })),
      DEFAULT_TAX_RATE,
    )
    totals = calculated
    await replaceLpoLines(
      existing.id,
      existing.organizationId,
      calculated.lines.map((line, index) => ({
        ...line,
        vehicleId: body.lines![index]?.vehicleId,
        notes: body.lines![index]?.notes,
        sortOrder: index,
      })),
    )
  }
  const updated = await updateLpoDraft(existing.id, {
    vendorId,
    vendorName,
    orderDate: body.orderDate,
    expectedAt: body.expectedAt,
    currency: body.currency?.toUpperCase(),
    paymentTerms: body.paymentTerms?.toUpperCase(),
    notes: body.notes,
    workOrderId: body.workOrderId,
    ...totals,
    approvalLevel: approvalLevelForAmount(totals.totalAmount),
  })
  if (!updated) throw conflict('LPO could not be updated.')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.LPO_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.LPO,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    metadata: { updated: true },
    meta,
  })
  return detail(updated)
}

export async function submitLpo(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.LPO_SUBMIT)
  const existing = await loadAccessibleLpo(ctx, id)
  if (!canTransitionLpo(existing.status, LPO_STATUSES.PENDING_APPROVAL)) {
    throw invalidField('status', `An LPO cannot move from ${toPublicEnum(existing.status)} to pending_approval`)
  }
  const lines = await listLpoLines(existing.id)
  if (!lines.length) throw invalidField('lines', 'At least one line is required before submit.')
  const submitted = await transitionLpo(existing.id, LPO_STATUSES.DRAFT, LPO_STATUSES.PENDING_APPROVAL, {
    submittedBy: ctx.userId,
    submittedAt: new Date(),
  })
  if (!submitted) throw conflict('LPO could not be submitted.')
  await recordStatusEvent({
    entityType: 'lpo',
    entityId: submitted.id,
    organizationId: submitted.organizationId,
    branchId: submitted.branchId,
    fromStatus: LPO_STATUSES.DRAFT,
    toStatus: LPO_STATUSES.PENDING_APPROVAL,
    reason: 'submitted',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.LPO_SUBMIT,
    entityType: AUDIT_ENTITY_TYPES.LPO,
    entityId: submitted.id,
    actorUserId: ctx.userId,
    organizationId: submitted.organizationId,
    branchId: submitted.branchId,
    metadata: { approvalLevel: submitted.approvalLevel },
    meta,
  })
  return detail(submitted)
}

export async function approveLpo(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.LPO_APPROVE)
  const existing = await loadAccessibleLpo(ctx, id)
  if (!canTransitionLpo(existing.status, LPO_STATUSES.APPROVED)) {
    throw invalidField('status', `An LPO cannot move from ${toPublicEnum(existing.status)} to approved`)
  }
  if (existing.createdBy === ctx.userId && existing.approvalLevel !== 'STANDARD') {
    throw conflict('Requester cannot approve this LPO under the current approval level.')
  }
  const documentNumber = existing.documentNumber ?? (await allocateProcurementNumber(existing.organizationId, 'lpo'))
  const approved = await transitionLpo(existing.id, existing.status, LPO_STATUSES.APPROVED, {
    documentNumber,
    approvedBy: ctx.userId,
    approvedAt: new Date(),
  })
  if (!approved) throw conflict('LPO could not be approved.')
  await recordStatusEvent({
    entityType: 'lpo',
    entityId: approved.id,
    organizationId: approved.organizationId,
    branchId: approved.branchId,
    fromStatus: existing.status,
    toStatus: LPO_STATUSES.APPROVED,
    reason: 'approved',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: approved.organizationId,
    eventType: 'lpo.approved',
    entityType: 'lpo',
    entityId: approved.id,
    idempotencyKey: `lpo.approved:${approved.id}`,
    payload: {
      lpoId: approved.id,
      documentNumber,
      vendorId: approved.vendorId,
      totalAmount: approved.totalAmount,
      currency: approved.currency,
    },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.LPO_APPROVE,
    entityType: AUDIT_ENTITY_TYPES.LPO,
    entityId: approved.id,
    actorUserId: ctx.userId,
    organizationId: approved.organizationId,
    branchId: approved.branchId,
    metadata: { documentNumber },
    meta,
  })
  return detail(approved)
}

export async function cancelLpo(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.LPO_CANCEL)
  const existing = await loadAccessibleLpo(ctx, id)
  if (!canTransitionLpo(existing.status, LPO_STATUSES.CANCELLED)) {
    throw invalidField('status', `An LPO cannot move from ${toPublicEnum(existing.status)} to cancelled`)
  }
  const cancelled = await transitionLpo(existing.id, existing.status, LPO_STATUSES.CANCELLED, {
    cancelledBy: ctx.userId,
    cancelledAt: new Date(),
  })
  if (!cancelled) throw conflict('LPO could not be cancelled.')
  await recordStatusEvent({
    entityType: 'lpo',
    entityId: cancelled.id,
    organizationId: cancelled.organizationId,
    branchId: cancelled.branchId,
    fromStatus: existing.status,
    toStatus: LPO_STATUSES.CANCELLED,
    reason,
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.LPO_CANCEL,
    entityType: AUDIT_ENTITY_TYPES.LPO,
    entityId: cancelled.id,
    actorUserId: ctx.userId,
    organizationId: cancelled.organizationId,
    branchId: cancelled.branchId,
    metadata: { reason },
    meta,
  })
  return detail(cancelled)
}
