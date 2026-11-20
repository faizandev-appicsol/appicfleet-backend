import {
  DEFAULT_CURRENCY,
  SERVICE_PRIORITIES,
  SERVICE_TYPES,
  WORK_ORDER_STATUSES,
  type WorkOrderStatus,
} from '../../constants/procurement.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import {
  allocateProcurementNumber,
  emitAccountingSourceEvent,
  insertWorkOrder,
  listStatusEvents,
  listWorkOrderLines,
  listWorkOrders,
  recordStatusEvent,
  replaceWorkOrderLines,
  transitionWorkOrder,
  updateWorkOrder,
  type WorkOrderRecord,
} from '../../repositories/procurement/procurement.repository.js'
import {
  findActiveAssignmentsOverlapping,
  insertVehicleAssignment,
  releaseVehicleAssignment,
} from '../../repositories/vehicles/vehicle-assignment.repository.js'
import { findVehicleById } from '../../repositories/vehicles/vehicle.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { addMoney, multiplyMoney, normalizeMoney } from '../../utils/money.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess } from '../authorization/authorization.service.js'
import { withVehicleLock } from '../vehicles/vehicle-lock.service.js'
import {
  canAccessProcurementRecord,
  isOrganizationWide,
  loadAccessibleWorkOrder,
  resolveProcurementOrganization,
} from './procurement-access.js'
import { canTransitionWorkOrder } from './procurement-rules.js'
import { toWorkOrderDetail, toWorkOrderResource } from './procurement.mapper.js'
import { requireActiveVendor } from './vendor.service.js'

type LineBody = {
  kind: 'PARTS' | 'LABOR' | 'OTHER' | string
  description: string
  quantity: number
  unitPrice: string
}

type CreateWorkOrderBody = {
  organizationId?: string
  vehicleId: string
  vendorId?: string
  lpoId?: string
  serviceType: string
  priority?: string
  description: string
  issue?: string
  requestedAt?: Date
  estimatedCost?: string
  currency?: string
  notes?: string
  assignedUserId?: string
  lines?: LineBody[]
}

function calcLines(lines: LineBody[]) {
  return lines.map((line, index) => {
    const unitPrice = normalizeMoney(line.unitPrice)
    const quantity = line.quantity
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error('quantity must be a positive integer')
    return {
      kind: String(line.kind).toUpperCase(),
      description: line.description,
      quantity,
      unitPrice,
      lineTotal: multiplyMoney(unitPrice, quantity),
      sortOrder: index,
    }
  })
}

async function detail(order: WorkOrderRecord) {
  const [lines, history] = await Promise.all([
    listWorkOrderLines(order.id),
    listStatusEvents('work_order', order.id),
  ])
  return toWorkOrderDetail(order, lines as Array<Record<string, unknown>>, history as Array<Record<string, unknown>>)
}

export async function listWorkOrderDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.SERVICE_VIEW)
  const organizationId = resolveProcurementOrganization(ctx, query.organizationId as string | undefined)
  if (query.branchId && !hasBranchAccess(ctx, String(query.branchId), organizationId)) {
    throw notFound('Branch was not found.')
  }
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listWorkOrders({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search as string | undefined,
    status: query.status ? (String(query.status).toUpperCase() as WorkOrderStatus) : undefined,
    priority: query.priority ? String(query.priority).toUpperCase() : undefined,
    serviceType: query.serviceType ? String(query.serviceType).toUpperCase() : undefined,
    vendorId: query.vendorId as string | undefined,
    vehicleId: query.vehicleId as string | undefined,
    branchId: query.branchId as string | undefined,
    sort: (query.sort as 'createdAt') ?? 'createdAt',
    order: (query.order as 'asc' | 'desc') ?? 'desc',
  })
  return toPaginated(page.items.map(toWorkOrderResource), pagination.page, pagination.limit, page.total)
}

export async function getWorkOrder(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.SERVICE_VIEW)
  return detail(await loadAccessibleWorkOrder(ctx, id))
}

export async function createWorkOrderDraft(ctx: AccessContext, body: CreateWorkOrderBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.SERVICE_CREATE)
  const vehicle = await findVehicleById(body.vehicleId)
  if (!vehicle || !canAccessProcurementRecord(ctx, vehicle)) throw notFound('Vehicle was not found.')
  const serviceType = body.serviceType.toUpperCase()
  if (!(Object.values(SERVICE_TYPES) as string[]).includes(serviceType)) {
    throw invalidField('serviceType', 'Unsupported service type.')
  }
  const priority = (body.priority ?? SERVICE_PRIORITIES.NORMAL).toUpperCase()
  if (!(Object.values(SERVICE_PRIORITIES) as string[]).includes(priority)) {
    throw invalidField('priority', 'Unsupported priority.')
  }

  let vendorId: string | undefined
  let vendorName: string | undefined
  if (body.vendorId) {
    const vendor = await requireActiveVendor(ctx, body.vendorId)
    vendorId = vendor.id
    vendorName = vendor.name
  }

  const lines = body.lines?.length ? calcLines(body.lines) : []
  const estimatedFromLines = lines.reduce((sum, line) => addMoney(sum, line.lineTotal), '0.00')
  const estimatedCost = normalizeMoney(body.estimatedCost ?? estimatedFromLines)

  const order = await insertWorkOrder({
    organizationId: vehicle.organizationId,
    legalEntityId: vehicle.legalEntityId,
    branchId: vehicle.branchId,
    vehicleId: vehicle.id,
    vehiclePlate: vehicle.plateNumber,
    vendorId,
    vendorName,
    lpoId: body.lpoId,
    serviceType,
    priority,
    status: WORK_ORDER_STATUSES.DRAFT,
    description: body.description.trim(),
    issue: body.issue,
    requestedAt: body.requestedAt ?? new Date(),
    estimatedCost,
    currency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    notes: body.notes,
    assignedUserId: body.assignedUserId,
    createdBy: ctx.userId,
  })
  if (lines.length) await replaceWorkOrderLines(order.id, order.organizationId, lines)
  await recordStatusEvent({
    entityType: 'work_order',
    entityId: order.id,
    organizationId: order.organizationId,
    branchId: order.branchId,
    toStatus: WORK_ORDER_STATUSES.DRAFT,
    reason: 'created',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.WORK_ORDER_CREATE,
    entityType: AUDIT_ENTITY_TYPES.WORK_ORDER,
    entityId: order.id,
    actorUserId: ctx.userId,
    organizationId: order.organizationId,
    branchId: order.branchId,
    metadata: { vehicleId: order.vehicleId, serviceType },
    meta,
  })
  return detail(order)
}

export async function requestWorkOrder(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.SERVICE_EDIT)
  const existing = await loadAccessibleWorkOrder(ctx, id)
  if (!canTransitionWorkOrder(existing.status, WORK_ORDER_STATUSES.REQUESTED)) {
    throw invalidField('status', `A work order cannot move from ${toPublicEnum(existing.status)} to requested`)
  }
  const updated = await transitionWorkOrder(existing.id, WORK_ORDER_STATUSES.DRAFT, WORK_ORDER_STATUSES.REQUESTED, {})
  if (!updated) throw conflict('Work order could not be requested.')
  await recordStatusEvent({
    entityType: 'work_order',
    entityId: updated.id,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    fromStatus: WORK_ORDER_STATUSES.DRAFT,
    toStatus: WORK_ORDER_STATUSES.REQUESTED,
    reason: 'requested',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.WORK_ORDER_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.WORK_ORDER,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    metadata: { status: WORK_ORDER_STATUSES.REQUESTED },
    meta,
  })
  return detail(updated)
}

export async function approveWorkOrder(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.SERVICE_APPROVE)
  const existing = await loadAccessibleWorkOrder(ctx, id)
  if (!canTransitionWorkOrder(existing.status, WORK_ORDER_STATUSES.APPROVED)) {
    throw invalidField('status', `A work order cannot move from ${toPublicEnum(existing.status)} to approved`)
  }
  const documentNumber = existing.documentNumber ?? (await allocateProcurementNumber(existing.organizationId, 'work_order'))
  const approved = await transitionWorkOrder(existing.id, existing.status, WORK_ORDER_STATUSES.APPROVED, {
    documentNumber,
    approvedBy: ctx.userId,
    approvedAt: new Date(),
  })
  if (!approved) throw conflict('Work order could not be approved.')
  await recordStatusEvent({
    entityType: 'work_order',
    entityId: approved.id,
    organizationId: approved.organizationId,
    branchId: approved.branchId,
    fromStatus: existing.status,
    toStatus: WORK_ORDER_STATUSES.APPROVED,
    reason: 'approved',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.WORK_ORDER_APPROVE,
    entityType: AUDIT_ENTITY_TYPES.WORK_ORDER,
    entityId: approved.id,
    actorUserId: ctx.userId,
    organizationId: approved.organizationId,
    branchId: approved.branchId,
    metadata: { documentNumber },
    meta,
  })
  return detail(approved)
}

export async function scheduleWorkOrder(
  ctx: AccessContext,
  id: string,
  body: { scheduledAt: Date; downtimeStartsAt: Date; downtimeEndsAt: Date },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.SERVICE_SCHEDULE)
  const existing = await loadAccessibleWorkOrder(ctx, id)
  if (!canTransitionWorkOrder(existing.status, WORK_ORDER_STATUSES.SCHEDULED)) {
    throw invalidField('status', `A work order cannot move from ${toPublicEnum(existing.status)} to scheduled`)
  }
  if (body.downtimeEndsAt.getTime() <= body.downtimeStartsAt.getTime()) {
    throw invalidField('downtimeEndsAt', 'Downtime end must be after start (half-open interval).')
  }

  const assignment = await withVehicleLock(existing.vehicleId, async () => {
    const vehicle = await findVehicleById(existing.vehicleId)
    if (!vehicle) throw notFound('Vehicle was not found.')
    const overlapping = await findActiveAssignmentsOverlapping(
      vehicle.id,
      vehicle.organizationId,
      body.downtimeStartsAt,
      body.downtimeEndsAt,
    )
    if (overlapping.length > 0) {
      throw conflict('Vehicle already has an active assignment overlapping the service downtime.')
    }
    return insertVehicleAssignment({
      vehicleId: vehicle.id,
      organizationId: vehicle.organizationId,
      branchId: vehicle.branchId,
      startsAt: body.downtimeStartsAt,
      endsAt: body.downtimeEndsAt,
      reason: `Service work order ${existing.documentNumber ?? existing.id}`,
      createdBy: ctx.userId,
      assignmentType: 'SERVICE',
      vehiclePlate: vehicle.plateNumber,
    })
  })

  const scheduled = await transitionWorkOrder(existing.id, existing.status, WORK_ORDER_STATUSES.SCHEDULED, {
    scheduledAt: body.scheduledAt,
    downtimeStartsAt: body.downtimeStartsAt,
    downtimeEndsAt: body.downtimeEndsAt,
    assignmentId: assignment.id,
  })
  if (!scheduled) throw conflict('Work order could not be scheduled.')
  await recordStatusEvent({
    entityType: 'work_order',
    entityId: scheduled.id,
    organizationId: scheduled.organizationId,
    branchId: scheduled.branchId,
    fromStatus: existing.status,
    toStatus: WORK_ORDER_STATUSES.SCHEDULED,
    reason: 'scheduled',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.WORK_ORDER_SCHEDULE,
    entityType: AUDIT_ENTITY_TYPES.WORK_ORDER,
    entityId: scheduled.id,
    actorUserId: ctx.userId,
    organizationId: scheduled.organizationId,
    branchId: scheduled.branchId,
    metadata: { assignmentId: assignment.id },
    meta,
  })
  return detail(scheduled)
}

export async function startWorkOrder(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.SERVICE_EDIT)
  const existing = await loadAccessibleWorkOrder(ctx, id)
  if (!canTransitionWorkOrder(existing.status, WORK_ORDER_STATUSES.IN_PROGRESS)) {
    throw invalidField('status', `A work order cannot move from ${toPublicEnum(existing.status)} to in_progress`)
  }
  const started = await transitionWorkOrder(existing.id, existing.status, WORK_ORDER_STATUSES.IN_PROGRESS, {
    startedAt: new Date(),
  })
  if (!started) throw conflict('Work order could not be started.')
  await recordStatusEvent({
    entityType: 'work_order',
    entityId: started.id,
    organizationId: started.organizationId,
    branchId: started.branchId,
    fromStatus: existing.status,
    toStatus: WORK_ORDER_STATUSES.IN_PROGRESS,
    reason: 'started',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.WORK_ORDER_START,
    entityType: AUDIT_ENTITY_TYPES.WORK_ORDER,
    entityId: started.id,
    actorUserId: ctx.userId,
    organizationId: started.organizationId,
    branchId: started.branchId,
    metadata: {},
    meta,
  })
  return detail(started)
}

export async function completeWorkOrder(
  ctx: AccessContext,
  id: string,
  body: { actualCost?: string; lines?: LineBody[] },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.SERVICE_COMPLETE)
  const existing = await loadAccessibleWorkOrder(ctx, id)
  if (!canTransitionWorkOrder(existing.status, WORK_ORDER_STATUSES.COMPLETED)) {
    throw invalidField('status', `A work order cannot move from ${toPublicEnum(existing.status)} to completed`)
  }
  if (existing.actualCost && body.actualCost && existing.actualCost !== body.actualCost) {
    throw conflict('Actual cost is locked after financial records are linked.')
  }

  let actualCost = existing.actualCost
  if (body.lines?.length) {
    const lines = calcLines(body.lines)
    await replaceWorkOrderLines(existing.id, existing.organizationId, lines)
    actualCost = lines.reduce((sum, line) => addMoney(sum, line.lineTotal), '0.00')
  } else if (body.actualCost) {
    actualCost = normalizeMoney(body.actualCost)
  } else if (!actualCost) {
    actualCost = existing.estimatedCost
  }

  const completed = await transitionWorkOrder(existing.id, existing.status, WORK_ORDER_STATUSES.COMPLETED, {
    completedAt: new Date(),
    actualCost,
  })
  if (!completed) throw conflict('Work order could not be completed.')

  if (existing.assignmentId) {
    await releaseVehicleAssignment(existing.vehicleId, existing.organizationId, existing.assignmentId)
  }

  await recordStatusEvent({
    entityType: 'work_order',
    entityId: completed.id,
    organizationId: completed.organizationId,
    branchId: completed.branchId,
    fromStatus: existing.status,
    toStatus: WORK_ORDER_STATUSES.COMPLETED,
    reason: 'completed',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: completed.organizationId,
    eventType: 'service_cost.incurred',
    entityType: 'work_order',
    entityId: completed.id,
    idempotencyKey: `service_cost.incurred:${completed.id}`,
    payload: {
      workOrderId: completed.id,
      vehicleId: completed.vehicleId,
      vendorId: completed.vendorId,
      actualCost: completed.actualCost,
      currency: completed.currency,
      serviceType: completed.serviceType,
    },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.WORK_ORDER_COMPLETE,
    entityType: AUDIT_ENTITY_TYPES.WORK_ORDER,
    entityId: completed.id,
    actorUserId: ctx.userId,
    organizationId: completed.organizationId,
    branchId: completed.branchId,
    metadata: { actualCost: completed.actualCost },
    meta,
  })
  return detail(completed)
}

export async function cancelWorkOrder(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.SERVICE_EDIT)
  const existing = await loadAccessibleWorkOrder(ctx, id)
  if (!canTransitionWorkOrder(existing.status, WORK_ORDER_STATUSES.CANCELLED)) {
    throw invalidField('status', `A work order cannot move from ${toPublicEnum(existing.status)} to cancelled`)
  }
  const cancelled = await transitionWorkOrder(existing.id, existing.status, WORK_ORDER_STATUSES.CANCELLED, {})
  if (!cancelled) throw conflict('Work order could not be cancelled.')
  if (existing.assignmentId) {
    await releaseVehicleAssignment(existing.vehicleId, existing.organizationId, existing.assignmentId)
  }
  await recordStatusEvent({
    entityType: 'work_order',
    entityId: cancelled.id,
    organizationId: cancelled.organizationId,
    branchId: cancelled.branchId,
    fromStatus: existing.status,
    toStatus: WORK_ORDER_STATUSES.CANCELLED,
    reason,
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.WORK_ORDER_CANCEL,
    entityType: AUDIT_ENTITY_TYPES.WORK_ORDER,
    entityId: cancelled.id,
    actorUserId: ctx.userId,
    organizationId: cancelled.organizationId,
    branchId: cancelled.branchId,
    metadata: { reason },
    meta,
  })
  return detail(cancelled)
}

export async function updateWorkOrderDraft(
  ctx: AccessContext,
  id: string,
  body: Partial<CreateWorkOrderBody>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.SERVICE_EDIT)
  const existing = await loadAccessibleWorkOrder(ctx, id)
  if (existing.status !== WORK_ORDER_STATUSES.DRAFT) throw conflict('Only draft work orders can be edited.')
  const patch: Record<string, unknown> = {}
  if (body.description !== undefined) patch.description = body.description.trim()
  if (body.issue !== undefined) patch.issue = body.issue
  if (body.notes !== undefined) patch.notes = body.notes
  if (body.serviceType) patch.serviceType = body.serviceType.toUpperCase()
  if (body.priority) patch.priority = body.priority.toUpperCase()
  if (body.estimatedCost) patch.estimatedCost = normalizeMoney(body.estimatedCost)
  if (body.lpoId !== undefined) patch.lpoId = body.lpoId
  if (body.vendorId) {
    const vendor = await requireActiveVendor(ctx, body.vendorId)
    patch.vendorId = vendor.id
    patch.vendorName = vendor.name
  }
  if (body.lines) {
    const lines = calcLines(body.lines)
    await replaceWorkOrderLines(existing.id, existing.organizationId, lines)
    patch.estimatedCost = lines.reduce((sum, line) => addMoney(sum, line.lineTotal), '0.00')
  }
  const updated = await updateWorkOrder(existing.id, patch)
  if (!updated) throw conflict('Work order could not be updated.')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.WORK_ORDER_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.WORK_ORDER,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    metadata: { fields: Object.keys(patch) },
    meta,
  })
  return detail(updated)
}
