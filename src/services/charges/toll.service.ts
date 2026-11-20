import {
  ASSIGNMENT_RESOLUTIONS,
  CHARGE_SOURCES,
  DEFAULT_CURRENCY,
  TOLL_PROVIDERS,
  TOLL_STATUSES,
  type TollStatus,
} from '../../constants/charges.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import {
  allocateChargeNumber,
  findTollByExternal,
  insertToll,
  listChargeStatusEvents,
  listDisputes,
  listTolls,
  recordChargeStatusEvent,
  transitionToll,
  updateToll,
  type TollRecord,
} from '../../repositories/charges/charges.repository.js'
import { emitAccountingSourceEvent } from '../../repositories/procurement/procurement.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { normalizeMoney } from '../../utils/money.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess, hasPermission } from '../authorization/authorization.service.js'
import { resolveEventResponsibility } from './assignment-resolution.service.js'
import { isOrganizationWide, loadAccessibleToll, resolveChargeOrganization } from './charges-access.js'
import { canTransitionToll } from './charges-rules.js'
import { toTollDetail, toTollResource } from './charges.mapper.js'

type CreateTollBody = {
  organizationId?: string
  legalEntityId?: string
  branchId?: string
  externalReference: string
  provider: string
  source?: string
  eventAt: Date
  vehicleId?: string
  vehiclePlate?: string
  amount: string
  currency?: string
  location?: string
  gate?: string
  description?: string
}

function initialStatus(resolution: string): TollStatus {
  if (resolution === ASSIGNMENT_RESOLUTIONS.ASSIGNED) return TOLL_STATUSES.ASSIGNED
  return TOLL_STATUSES.PENDING_REVIEW
}

async function detail(toll: TollRecord) {
  const [history, disputes] = await Promise.all([
    listChargeStatusEvents('toll', toll.id),
    listDisputes(toll.organizationId, 'TOLL', toll.id),
  ])
  return toTollDetail(toll, history as Array<Record<string, unknown>>, disputes as Array<Record<string, unknown>>)
}

export async function listTollDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.TOLL_VIEW)
  const organizationId = resolveChargeOrganization(ctx, query.organizationId as string | undefined)
  if (query.branchId && !hasBranchAccess(ctx, String(query.branchId), organizationId)) {
    throw notFound('Branch was not found.')
  }
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listTolls({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search as string | undefined,
    status: query.status ? (String(query.status).toUpperCase() as TollStatus) : undefined,
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
  return toPaginated(page.items.map(toTollResource), pagination.page, pagination.limit, page.total)
}

export async function getToll(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.TOLL_VIEW)
  return detail(await loadAccessibleToll(ctx, id))
}

export async function createToll(ctx: AccessContext, body: CreateTollBody, meta: RequestMeta) {
  const isImport = body.source?.toUpperCase() === CHARGE_SOURCES.IMPORT
  if (isImport) {
    if (!hasPermission(ctx, PERMISSIONS.FINE_IMPORT_PROCESS) && !hasPermission(ctx, PERMISSIONS.TOLL_CREATE)) {
      assertPermission(ctx, PERMISSIONS.TOLL_CREATE)
    }
  } else {
    assertPermission(ctx, PERMISSIONS.TOLL_CREATE)
  }
  const organizationId = resolveChargeOrganization(ctx, body.organizationId)
  const provider = body.provider.toUpperCase()
  if (!(Object.values(TOLL_PROVIDERS) as string[]).includes(provider)) {
    throw invalidField('provider', 'Unsupported toll provider.')
  }
  const externalReference = body.externalReference.trim()
  const existing = await findTollByExternal(organizationId, provider, externalReference)
  if (existing) throw conflict('A toll with this provider external reference already exists.')

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

  const status =
    body.source?.toUpperCase() === CHARGE_SOURCES.IMPORT
      ? responsibility.resolution === ASSIGNMENT_RESOLUTIONS.ASSIGNED
        ? TOLL_STATUSES.ASSIGNED
        : TOLL_STATUSES.IMPORTED
      : initialStatus(responsibility.resolution)

  const documentNumber = await allocateChargeNumber(organizationId, 'toll')
  const toll = await insertToll({
    organizationId,
    legalEntityId,
    branchId,
    documentNumber,
    externalReference,
    provider,
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
    location: body.location,
    gate: body.gate,
    description: body.description,
    status,
    createdBy: ctx.userId,
  })

  await recordChargeStatusEvent({
    entityType: 'toll',
    entityId: toll.id,
    organizationId,
    branchId,
    toStatus: status,
    reason: responsibility.reviewReason ?? 'created',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId,
    eventType: 'toll.created',
    entityType: 'toll',
    entityId: toll.id,
    idempotencyKey: `toll.created:${toll.id}`,
    payload: {
      tollId: toll.id,
      provider,
      amount: toll.amount,
      currency: toll.currency,
      eventAt: toll.eventAt.toISOString(),
      assignmentResolution: toll.assignmentResolution,
    },
  })
  if (toll.assignmentResolution === ASSIGNMENT_RESOLUTIONS.ASSIGNED) {
    await emitAccountingSourceEvent({
      organizationId,
      eventType: 'toll.assigned',
      entityType: 'toll',
      entityId: toll.id,
      idempotencyKey: `toll.assigned:${toll.id}`,
      payload: { tollId: toll.id, customerId: toll.customerId, contractId: toll.contractId },
    })
  }
  await recordAuditEvent({
    action: AUDIT_ACTIONS.TOLL_CREATE,
    entityType: AUDIT_ENTITY_TYPES.TOLL,
    entityId: toll.id,
    actorUserId: ctx.userId,
    organizationId,
    branchId,
    metadata: { externalReference, provider, assignmentResolution: toll.assignmentResolution },
    meta,
  })
  return detail(toll)
}

export async function reviewToll(
  ctx: AccessContext,
  id: string,
  body: { contractId?: string; customerId?: string; customerName?: string; notes?: string },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.TOLL_REVIEW)
  const existing = await loadAccessibleToll(ctx, id)
  if (!canTransitionToll(existing.status, TOLL_STATUSES.ASSIGNED)) {
    throw invalidField('status', `Toll cannot be reviewed from ${toPublicEnum(existing.status)}`)
  }
  if (!body.contractId || !body.customerId) {
    throw invalidField('contractId', 'Manual review requires contractId and customerId.')
  }
  const updated = await transitionToll(existing.id, existing.status, TOLL_STATUSES.ASSIGNED, {
    contractId: body.contractId,
    customerId: body.customerId,
    customerName: body.customerName,
    assignmentResolution: ASSIGNMENT_RESOLUTIONS.ASSIGNED,
    reviewReason: body.notes,
    reviewedBy: ctx.userId,
    reviewedAt: new Date(),
  })
  if (!updated) throw conflict('Toll could not be reviewed.')
  await recordChargeStatusEvent({
    entityType: 'toll',
    entityId: updated.id,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    fromStatus: existing.status,
    toStatus: TOLL_STATUSES.ASSIGNED,
    reason: body.notes ?? 'reviewed',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.TOLL_REVIEW,
    entityType: AUDIT_ENTITY_TYPES.TOLL,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    metadata: { contractId: body.contractId },
    meta,
  })
  return detail(updated)
}

export async function approveToll(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.TOLL_APPROVE)
  const existing = await loadAccessibleToll(ctx, id)
  if (!canTransitionToll(existing.status, TOLL_STATUSES.APPROVED)) {
    throw invalidField('status', `Toll cannot move from ${toPublicEnum(existing.status)} to approved`)
  }
  if (existing.assignmentResolution !== ASSIGNMENT_RESOLUTIONS.ASSIGNED || !existing.customerId || !existing.contractId) {
    throw conflict('Toll must be assigned before approval.')
  }
  const approved = await transitionToll(existing.id, existing.status, TOLL_STATUSES.APPROVED, {
    approvedBy: ctx.userId,
    approvedAt: new Date(),
  })
  if (!approved) throw conflict('Toll could not be approved.')
  await recordChargeStatusEvent({
    entityType: 'toll',
    entityId: approved.id,
    organizationId: approved.organizationId,
    branchId: approved.branchId,
    fromStatus: existing.status,
    toStatus: TOLL_STATUSES.APPROVED,
    reason: 'approved',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: approved.organizationId,
    eventType: 'toll.approved',
    entityType: 'toll',
    entityId: approved.id,
    idempotencyKey: `toll.approved:${approved.id}`,
    payload: { tollId: approved.id, amount: approved.amount, currency: approved.currency },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.TOLL_APPROVE,
    entityType: AUDIT_ENTITY_TYPES.TOLL,
    entityId: approved.id,
    actorUserId: ctx.userId,
    organizationId: approved.organizationId,
    branchId: approved.branchId,
    metadata: {},
    meta,
  })
  return detail(approved)
}

export async function updateTollFields(
  ctx: AccessContext,
  id: string,
  body: Partial<{ description: string; location: string; gate: string }>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.TOLL_EDIT)
  const existing = await loadAccessibleToll(ctx, id)
  if (![TOLL_STATUSES.IMPORTED, TOLL_STATUSES.PENDING_REVIEW, TOLL_STATUSES.ASSIGNED].includes(existing.status as typeof TOLL_STATUSES.IMPORTED)) {
    throw conflict('Only early-lifecycle tolls can be edited.')
  }
  const updated = await updateToll(existing.id, body)
  if (!updated) throw conflict('Toll could not be updated.')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.TOLL_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.TOLL,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    metadata: { fields: Object.keys(body) },
    meta,
  })
  return detail(updated)
}
