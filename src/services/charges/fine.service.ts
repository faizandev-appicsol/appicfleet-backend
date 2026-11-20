import {
  ASSIGNMENT_RESOLUTIONS,
  CHARGE_SOURCES,
  DEFAULT_CURRENCY,
  FINE_STATUSES,
  FINE_TYPES,
  type FineStatus,
} from '../../constants/charges.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import {
  allocateChargeNumber,
  findFineByExternal,
  insertFine,
  listChargeStatusEvents,
  listDisputes,
  listFines,
  recordChargeStatusEvent,
  transitionFine,
  updateFine,
  type FineRecord,
} from '../../repositories/charges/charges.repository.js'
import { emitAccountingSourceEvent } from '../../repositories/procurement/procurement.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { normalizeMoney } from '../../utils/money.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess, hasPermission } from '../authorization/authorization.service.js'
import { resolveEventResponsibility } from './assignment-resolution.service.js'
import { isOrganizationWide, loadAccessibleFine, resolveChargeOrganization } from './charges-access.js'
import { canTransitionFine } from './charges-rules.js'
import { toFineDetail, toFineResource } from './charges.mapper.js'

type CreateFineBody = {
  organizationId?: string
  legalEntityId?: string
  branchId?: string
  externalReference: string
  provider: string
  fineType: string
  source?: string
  eventAt: Date
  vehicleId?: string
  vehiclePlate?: string
  amount: string
  currency?: string
  description?: string
  location?: string
  authority?: string
  evidenceKey?: string
}

function initialStatus(resolution: string): FineStatus {
  if (resolution === ASSIGNMENT_RESOLUTIONS.ASSIGNED) return FINE_STATUSES.ASSIGNED
  return FINE_STATUSES.PENDING_REVIEW
}

async function detail(fine: FineRecord) {
  const [history, disputes] = await Promise.all([
    listChargeStatusEvents('fine', fine.id),
    listDisputes(fine.organizationId, 'FINE', fine.id),
  ])
  return toFineDetail(fine, history as Array<Record<string, unknown>>, disputes as Array<Record<string, unknown>>)
}

export async function listFineDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.FINE_VIEW)
  const organizationId = resolveChargeOrganization(ctx, query.organizationId as string | undefined)
  if (query.branchId && !hasBranchAccess(ctx, String(query.branchId), organizationId)) {
    throw notFound('Branch was not found.')
  }
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listFines({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search as string | undefined,
    status: query.status ? (String(query.status).toUpperCase() as FineStatus) : undefined,
    fineType: query.fineType ? String(query.fineType).toUpperCase() : undefined,
    provider: query.provider ? String(query.provider).toUpperCase() : undefined,
    vehicleId: query.vehicleId as string | undefined,
    customerId: query.customerId as string | undefined,
    contractId: query.contractId as string | undefined,
    branchId: query.branchId as string | undefined,
    eventFrom: query.eventFrom as Date | undefined,
    eventTo: query.eventTo as Date | undefined,
    sort: (query.sort as 'createdAt') ?? 'createdAt',
    order: (query.order as 'asc' | 'desc') ?? 'desc',
  })
  return toPaginated(page.items.map(toFineResource), pagination.page, pagination.limit, page.total)
}

export async function getFine(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.FINE_VIEW)
  return detail(await loadAccessibleFine(ctx, id))
}

export async function createFine(ctx: AccessContext, body: CreateFineBody, meta: RequestMeta) {
  const isImport = body.source?.toUpperCase() === CHARGE_SOURCES.IMPORT
  if (isImport) {
    if (!hasPermission(ctx, PERMISSIONS.FINE_IMPORT_PROCESS) && !hasPermission(ctx, PERMISSIONS.FINE_CREATE)) {
      assertPermission(ctx, PERMISSIONS.FINE_CREATE)
    }
  } else {
    assertPermission(ctx, PERMISSIONS.FINE_CREATE)
  }
  const organizationId = resolveChargeOrganization(ctx, body.organizationId)
  const fineType = body.fineType.toUpperCase()
  if (!(Object.values(FINE_TYPES) as string[]).includes(fineType)) {
    throw invalidField('fineType', 'Unsupported fine type.')
  }
  const provider = body.provider.trim().toUpperCase()
  const externalReference = body.externalReference.trim()
  const existing = await findFineByExternal(organizationId, provider, externalReference)
  if (existing) throw conflict('A fine with this provider external reference already exists.')

  const responsibility = await resolveEventResponsibility({
    organizationId,
    vehicleId: body.vehicleId,
    vehiclePlate: body.vehiclePlate,
    eventAt: body.eventAt,
  })

  const legalEntityId = body.legalEntityId ?? responsibility.legalEntityId
  const branchId = body.branchId ?? responsibility.branchId
  if (!legalEntityId || !branchId) {
    throw invalidField('branchId', 'Branch and legal entity are required when vehicle cannot be resolved.')
  }
  if (!hasBranchAccess(ctx, branchId, organizationId)) throw notFound('Branch was not found.')

  const status = body.source?.toUpperCase() === CHARGE_SOURCES.IMPORT
    ? (responsibility.resolution === ASSIGNMENT_RESOLUTIONS.ASSIGNED ? FINE_STATUSES.ASSIGNED : FINE_STATUSES.IMPORTED)
    : initialStatus(responsibility.resolution)

  const documentNumber = await allocateChargeNumber(organizationId, 'fine')
  const fine = await insertFine({
    organizationId,
    legalEntityId,
    branchId,
    documentNumber,
    externalReference,
    provider,
    fineType,
    source: (body.source ?? CHARGE_SOURCES.MANUAL).toUpperCase(),
    eventAt: body.eventAt,
    receivedAt: new Date(),
    vehicleId: responsibility.vehicle?.id,
    vehiclePlate: responsibility.vehicle?.plateNumber ?? body.vehiclePlate?.toUpperCase(),
    assignmentId: responsibility.assignmentId,
    contractId: responsibility.contractId,
    customerId: responsibility.customerId,
    customerName: responsibility.customerName,
    assignmentResolution: responsibility.resolution,
    reviewReason: responsibility.reviewReason,
    currency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    amount: normalizeMoney(body.amount),
    description: body.description,
    location: body.location,
    authority: body.authority,
    status,
    evidenceKey: body.evidenceKey,
    createdBy: ctx.userId,
  })

  await recordChargeStatusEvent({
    entityType: 'fine',
    entityId: fine.id,
    organizationId,
    branchId,
    toStatus: status,
    reason: responsibility.reviewReason ?? 'created',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId,
    eventType: 'fine.created',
    entityType: 'fine',
    entityId: fine.id,
    idempotencyKey: `fine.created:${fine.id}`,
    payload: {
      fineId: fine.id,
      amount: fine.amount,
      currency: fine.currency,
      eventAt: fine.eventAt.toISOString(),
      assignmentResolution: fine.assignmentResolution,
      customerId: fine.customerId,
      contractId: fine.contractId,
    },
  })
  if (fine.assignmentResolution === ASSIGNMENT_RESOLUTIONS.ASSIGNED) {
    await emitAccountingSourceEvent({
      organizationId,
      eventType: 'fine.assigned',
      entityType: 'fine',
      entityId: fine.id,
      idempotencyKey: `fine.assigned:${fine.id}`,
      payload: { fineId: fine.id, customerId: fine.customerId, contractId: fine.contractId },
    })
  }
  await recordAuditEvent({
    action: AUDIT_ACTIONS.FINE_CREATE,
    entityType: AUDIT_ENTITY_TYPES.FINE,
    entityId: fine.id,
    actorUserId: ctx.userId,
    organizationId,
    branchId,
    metadata: { externalReference, assignmentResolution: fine.assignmentResolution },
    meta,
  })
  return detail(fine)
}

export async function reviewFine(
  ctx: AccessContext,
  id: string,
  body: { contractId?: string; customerId?: string; customerName?: string; notes?: string },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.FINE_REVIEW)
  const existing = await loadAccessibleFine(ctx, id)
  if (!canTransitionFine(existing.status, FINE_STATUSES.ASSIGNED) && existing.status !== FINE_STATUSES.PENDING_REVIEW && existing.status !== FINE_STATUSES.IMPORTED) {
    throw invalidField('status', `Fine cannot be reviewed from ${toPublicEnum(existing.status)}`)
  }
  if (!body.contractId || !body.customerId) {
    throw invalidField('contractId', 'Manual review requires contractId and customerId.')
  }
  const updated = await transitionFine(existing.id, existing.status, FINE_STATUSES.ASSIGNED, {
    contractId: body.contractId,
    customerId: body.customerId,
    customerName: body.customerName,
    assignmentResolution: ASSIGNMENT_RESOLUTIONS.ASSIGNED,
    reviewReason: body.notes,
    reviewedBy: ctx.userId,
    reviewedAt: new Date(),
  })
  if (!updated) throw conflict('Fine could not be reviewed.')
  await recordChargeStatusEvent({
    entityType: 'fine',
    entityId: updated.id,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    fromStatus: existing.status,
    toStatus: FINE_STATUSES.ASSIGNED,
    reason: body.notes ?? 'reviewed',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: updated.organizationId,
    eventType: 'fine.assigned',
    entityType: 'fine',
    entityId: updated.id,
    idempotencyKey: `fine.assigned:${updated.id}`,
    payload: { fineId: updated.id, customerId: updated.customerId, contractId: updated.contractId },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.FINE_REVIEW,
    entityType: AUDIT_ENTITY_TYPES.FINE,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    metadata: { contractId: body.contractId, customerId: body.customerId },
    meta,
  })
  return detail(updated)
}

export async function approveFine(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.FINE_APPROVE)
  const existing = await loadAccessibleFine(ctx, id)
  if (!canTransitionFine(existing.status, FINE_STATUSES.APPROVED)) {
    throw invalidField('status', `Fine cannot move from ${toPublicEnum(existing.status)} to approved`)
  }
  if (existing.assignmentResolution !== ASSIGNMENT_RESOLUTIONS.ASSIGNED || !existing.customerId || !existing.contractId) {
    throw conflict('Fine must be assigned to a customer/contract before approval.')
  }
  const approved = await transitionFine(existing.id, existing.status, FINE_STATUSES.APPROVED, {
    approvedBy: ctx.userId,
    approvedAt: new Date(),
  })
  if (!approved) throw conflict('Fine could not be approved.')
  await recordChargeStatusEvent({
    entityType: 'fine',
    entityId: approved.id,
    organizationId: approved.organizationId,
    branchId: approved.branchId,
    fromStatus: existing.status,
    toStatus: FINE_STATUSES.APPROVED,
    reason: 'approved',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: approved.organizationId,
    eventType: 'fine.approved',
    entityType: 'fine',
    entityId: approved.id,
    idempotencyKey: `fine.approved:${approved.id}`,
    payload: { fineId: approved.id, amount: approved.amount, currency: approved.currency },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.FINE_APPROVE,
    entityType: AUDIT_ENTITY_TYPES.FINE,
    entityId: approved.id,
    actorUserId: ctx.userId,
    organizationId: approved.organizationId,
    branchId: approved.branchId,
    metadata: {},
    meta,
  })
  return detail(approved)
}

export async function waiveFine(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.FINE_WAIVE)
  const existing = await loadAccessibleFine(ctx, id)
  if (!canTransitionFine(existing.status, FINE_STATUSES.WAIVED)) {
    throw invalidField('status', `Fine cannot be waived from ${toPublicEnum(existing.status)}`)
  }
  const waived = await transitionFine(existing.id, existing.status, FINE_STATUSES.WAIVED, { waivedReason: reason })
  if (!waived) throw conflict('Fine could not be waived.')
  await recordChargeStatusEvent({
    entityType: 'fine',
    entityId: waived.id,
    organizationId: waived.organizationId,
    branchId: waived.branchId,
    fromStatus: existing.status,
    toStatus: FINE_STATUSES.WAIVED,
    reason,
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: waived.organizationId,
    eventType: 'fine.waived',
    entityType: 'fine',
    entityId: waived.id,
    idempotencyKey: `fine.waived:${waived.id}`,
    payload: { fineId: waived.id, reason },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.FINE_WAIVE,
    entityType: AUDIT_ENTITY_TYPES.FINE,
    entityId: waived.id,
    actorUserId: ctx.userId,
    organizationId: waived.organizationId,
    branchId: waived.branchId,
    metadata: { reason },
    meta,
  })
  return detail(waived)
}

export async function updateFineDraftFields(
  ctx: AccessContext,
  id: string,
  body: Partial<{ description: string; location: string; authority: string; evidenceKey: string }>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.FINE_EDIT)
  const existing = await loadAccessibleFine(ctx, id)
  if (![FINE_STATUSES.IMPORTED, FINE_STATUSES.PENDING_REVIEW, FINE_STATUSES.ASSIGNED].includes(existing.status as typeof FINE_STATUSES.IMPORTED)) {
    throw conflict('Only early-lifecycle fines can be edited.')
  }
  const updated = await updateFine(existing.id, body)
  if (!updated) throw conflict('Fine could not be updated.')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.FINE_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.FINE,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    metadata: { fields: Object.keys(body) },
    meta,
  })
  return detail(updated)
}
