import { REMINDER_BASES, REMINDER_STATUSES, SERVICE_TYPES, type ReminderStatus } from '../../constants/procurement.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  findServiceReminderById,
  insertServiceReminder,
  listServiceReminders,
  updateServiceReminder,
} from '../../repositories/procurement/procurement.repository.js'
import { findVehicleById } from '../../repositories/vehicles/vehicle.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess } from '../authorization/authorization.service.js'
import {
  canAccessProcurementRecord,
  isOrganizationWide,
  resolveProcurementOrganization,
} from './procurement-access.js'
import { toReminderResource } from './procurement.mapper.js'

type CreateReminderBody = {
  organizationId?: string
  vehicleId: string
  serviceType: string
  basis: string
  dueAt?: Date
  dueMileage?: number
  intervalDays?: number
  intervalKm?: number
  notes?: string
}

export async function listReminderDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.SERVICE_REMINDER_VIEW)
  const organizationId = resolveProcurementOrganization(ctx, query.organizationId as string | undefined)
  if (query.branchId && !hasBranchAccess(ctx, String(query.branchId), organizationId)) {
    throw notFound('Branch was not found.')
  }
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listServiceReminders({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    skip: pagination.skip,
    take: pagination.take,
    status: query.status ? (String(query.status).toUpperCase() as ReminderStatus) : undefined,
    vehicleId: query.vehicleId as string | undefined,
    branchId: query.branchId as string | undefined,
  })
  return toPaginated(
    page.items.map((row) => toReminderResource(row as Record<string, unknown>)),
    pagination.page,
    pagination.limit,
    page.total,
  )
}

export async function createReminder(ctx: AccessContext, body: CreateReminderBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.SERVICE_REMINDER_CREATE)
  const vehicle = await findVehicleById(body.vehicleId)
  if (!vehicle || !canAccessProcurementRecord(ctx, vehicle)) throw notFound('Vehicle was not found.')
  const serviceType = body.serviceType.toUpperCase()
  if (!(Object.values(SERVICE_TYPES) as string[]).includes(serviceType)) {
    throw invalidField('serviceType', 'Unsupported service type.')
  }
  const basis = body.basis.toUpperCase()
  if (!(Object.values(REMINDER_BASES) as string[]).includes(basis)) {
    throw invalidField('basis', 'Unsupported reminder basis.')
  }
  if (basis === REMINDER_BASES.DATE && !body.dueAt) {
    throw invalidField('dueAt', 'dueAt is required for date-based reminders.')
  }
  if (basis === REMINDER_BASES.MILEAGE && body.dueMileage == null) {
    throw invalidField('dueMileage', 'dueMileage is required for mileage-based reminders.')
  }
  const reminder = await insertServiceReminder({
    organizationId: vehicle.organizationId,
    legalEntityId: vehicle.legalEntityId,
    branchId: vehicle.branchId,
    vehicleId: vehicle.id,
    vehiclePlate: vehicle.plateNumber,
    serviceType,
    basis,
    dueAt: body.dueAt,
    dueMileage: body.dueMileage,
    intervalDays: body.intervalDays,
    intervalKm: body.intervalKm,
    status: REMINDER_STATUSES.UPCOMING,
    notes: body.notes,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.SERVICE_REMINDER_CREATE,
    entityType: AUDIT_ENTITY_TYPES.SERVICE_REMINDER,
    entityId: String(reminder._id),
    actorUserId: ctx.userId,
    organizationId: vehicle.organizationId,
    branchId: vehicle.branchId,
    metadata: { serviceType, basis },
    meta,
  })
  return toReminderResource(reminder.toObject() as Record<string, unknown>)
}

async function loadAccessibleReminder(ctx: AccessContext, id: string) {
  const reminder = await findServiceReminderById(id)
  if (!reminder) throw notFound('Service reminder was not found.')
  const scoped = {
    organizationId: String(reminder.organizationId),
    branchId: String(reminder.branchId),
    legalEntityId: String(reminder.legalEntityId),
  }
  if (!canAccessProcurementRecord(ctx, scoped)) throw notFound('Service reminder was not found.')
  return reminder
}

export async function completeReminder(ctx: AccessContext, id: string, workOrderId: string | undefined, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.SERVICE_REMINDER_MANAGE)
  const existing = await loadAccessibleReminder(ctx, id)
  if (String(existing.status) === REMINDER_STATUSES.COMPLETED || String(existing.status) === REMINDER_STATUSES.DISMISSED) {
    throw conflict('Reminder is already closed.')
  }
  const updated = await updateServiceReminder(id, {
    status: REMINDER_STATUSES.COMPLETED,
    completedAt: new Date(),
    workOrderId,
  })
  if (!updated) throw conflict('Reminder could not be completed.')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.SERVICE_REMINDER_COMPLETE,
    entityType: AUDIT_ENTITY_TYPES.SERVICE_REMINDER,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: String(existing.organizationId),
    branchId: String(existing.branchId),
    metadata: { workOrderId },
    meta,
  })
  return toReminderResource(updated as Record<string, unknown>)
}

export async function dismissReminder(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.SERVICE_REMINDER_MANAGE)
  const existing = await loadAccessibleReminder(ctx, id)
  if (String(existing.status) === REMINDER_STATUSES.COMPLETED || String(existing.status) === REMINDER_STATUSES.DISMISSED) {
    throw conflict('Reminder is already closed.')
  }
  const updated = await updateServiceReminder(id, { status: REMINDER_STATUSES.DISMISSED })
  if (!updated) throw conflict('Reminder could not be dismissed.')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.SERVICE_REMINDER_DISMISS,
    entityType: AUDIT_ENTITY_TYPES.SERVICE_REMINDER,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: String(existing.organizationId),
    branchId: String(existing.branchId),
    metadata: {},
    meta,
  })
  return toReminderResource(updated as Record<string, unknown>)
}
