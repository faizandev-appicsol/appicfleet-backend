import {
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  CALENDAR_RESULT_LIMIT,
  HOLD_DEFAULT_MINUTES,
  type BookingStatus,
} from '../../constants/bookings.js'
import { CUSTOMER_STATUSES } from '../../constants/customers.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import { findBranchById } from '../../repositories/branches/branch.repository.js'
import {
  allocateBookingNumber,
  attachClaim,
  claimKey,
  findBookingInOrg,
  findCandidateVehicles,
  findOverlappingAssignmentVehicleIds,
  hashRequest,
  idempotencyModel,
  insertBooking,
  insertStatusEvent,
  intakeModel,
  listBookings,
  listExpiredHolds,
  listStatusEvents,
  releaseClaim,
  transitionBooking,
  updateDraftBooking,
  type BookingRecord,
} from '../../repositories/bookings/booking.repository.js'
import { findCustomerById } from '../../repositories/customers/customer.repository.js'
import {
  findActiveAssignmentsOverlapping,
  insertVehicleAssignment,
  releaseVehicleAssignment,
} from '../../repositories/vehicles/vehicle-assignment.repository.js'
import { findVehicleById, type VehicleRecord } from '../../repositories/vehicles/vehicle.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  AvailabilityQuery,
  CalendarQuery,
  CancelBookingBody,
  CreateBookingBody,
  HoldBookingBody,
  IntakeBookingBody,
  ListBookingsQuery,
  UpdateBookingBody,
} from '../../validations/booking.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertBranchAccess, assertPermission } from '../authorization/authorization.service.js'
import { canAccessCustomer } from '../customers/customer-access.js'
import { decideAssignment } from '../vehicles/availability-rules.js'
import { isNonOperationalStatus } from '../vehicles/status-rules.js'
import { loadAccessibleVehicle } from '../vehicles/vehicle-access.js'
import { withVehicleLock } from '../vehicles/vehicle-lock.service.js'
import { canAccessBooking, isOrganizationWide, loadAccessibleBooking, resolveBookingOrganization } from './booking-access.js'
import { toBookingResource, toStatusEventResource, type BookingResource } from './booking.mapper.js'
import { quoteBooking } from './booking-pricing.js'
import { canTransition, holdIsOpen, isValidInterval } from './booking-rules.js'
import { logger } from '../../lib/logger/index.js'

function holdUntil(now: Date, minutes: number | undefined): Date {
  return new Date(now.getTime() + (minutes ?? HOLD_DEFAULT_MINUTES) * 60_000)
}

async function requireCustomer(ctx: AccessContext, customerId: string, organizationId: string) {
  const customer = await findCustomerById(customerId)
  if (!customer || customer.organizationId !== organizationId || !canAccessCustomer(ctx, customer)) {
    throw notFound('Customer was not found.')
  }
  if (customer.status !== CUSTOMER_STATUSES.ACTIVE) {
    throw invalidField('customerId', 'The customer is not active')
  }
  return customer
}

async function requireVehicle(ctx: AccessContext, vehicleId: string, organizationId: string) {
  const vehicle = await loadAccessibleVehicle(ctx, vehicleId)
  if (vehicle.organizationId !== organizationId) throw notFound('Vehicle was not found.')
  return vehicle
}

async function requireBranch(ctx: AccessContext, branchId: string, organizationId: string) {
  const branch = await findBranchById(branchId)
  if (!branch || branch.organizationId !== organizationId) {
    throw invalidField('returnBranchId', 'The branch was not found')
  }
  assertBranchAccess(ctx, branch.id, organizationId)
  return branch
}

async function writeHistory(
  booking: BookingRecord,
  from: BookingStatus | undefined,
  to: BookingStatus,
  reason: string | undefined,
  actorUserId: string | undefined,
) {
  await insertStatusEvent({
    bookingId: booking.id,
    organizationId: booking.organizationId,
    branchId: booking.branchId,
    fromStatus: from,
    toStatus: to,
    reason,
    actorUserId,
  })
}

function assertMove(from: BookingStatus, to: BookingStatus) {
  if (!canTransition(from, to)) {
    throw invalidField('status', `A booking cannot move from ${toPublicEnum(from)} to ${toPublicEnum(to)}`)
  }
}

async function reserveWindow(
  vehicle: VehicleRecord,
  startsAt: Date,
  endsAt: Date,
  reason: string,
  actorUserId: string,
) {
  const current = await findVehicleById(vehicle.id)
  if (!current || current.organizationId !== vehicle.organizationId) {
    throw notFound('Vehicle was not found.')
  }
  if (isNonOperationalStatus(current.status)) {
    throw conflict(`Vehicle is ${toPublicEnum(current.status)} and cannot be reserved.`)
  }
  const overlapping = await findActiveAssignmentsOverlapping(
    current.id,
    current.organizationId,
    startsAt,
    endsAt,
  )
  const decision = decideAssignment(overlapping, { startsAt, endsAt })
  if (!decision.accepted) {
    throw conflict('That vehicle is no longer available for this period. Choose another vehicle or time.')
  }
  return insertVehicleAssignment({
    vehicleId: current.id,
    organizationId: current.organizationId,
    branchId: current.branchId,
    startsAt,
    endsAt,
    reason,
    createdBy: actorUserId,
  })
}

export async function listBookingDirectory(ctx: AccessContext, query: ListBookingsQuery) {
  assertPermission(ctx, PERMISSIONS.BOOKING_VIEW)
  const organizationId = resolveBookingOrganization(ctx, query.organizationId)
  if (query.branchId) assertBranchAccess(ctx, query.branchId, organizationId)
  const pagination = resolvePagination(query)
  const orgWide = isOrganizationWide(ctx)
  let branchIds: string[] | undefined = orgWide ? undefined : [...ctx.branchIds]
  if (query.branchId) {
    branchIds = branchIds ? branchIds.filter((id) => id === query.branchId) : [query.branchId]
  }
  const legalEntityIds = !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined
  const result = await listBookings({
    organizationId,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search?.trim() || undefined,
    status: query.status,
    source: query.source,
    branchIds,
    legalEntityIds,
    vehicleId: query.vehicleId,
    customerId: query.customerId,
    vehicleCategory: undefined,
    pickupFrom: query.pickupFrom,
    pickupTo: query.pickupTo,
    returnFrom: query.returnFrom,
    returnTo: query.returnTo,
    sort: query.sort ?? 'startsAt',
    order: query.order ?? 'asc',
  })
  return toPaginated(result.items.map(toBookingResource), pagination.page, pagination.limit, result.total)
}

export async function getBooking(ctx: AccessContext, id: string): Promise<BookingResource> {
  assertPermission(ctx, PERMISSIONS.BOOKING_VIEW)
  return toBookingResource(await loadAccessibleBooking(ctx, id))
}

export async function getBookingHistory(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.BOOKING_VIEW)
  const booking = await loadAccessibleBooking(ctx, id)
  const events = await listStatusEvents(booking.id)
  return events.map(toStatusEventResource)
}

export async function createDraft(
  ctx: AccessContext,
  input: CreateBookingBody,
  meta: RequestMeta,
): Promise<BookingResource> {
  assertPermission(ctx, PERMISSIONS.BOOKING_CREATE)
  const organizationId = resolveBookingOrganization(ctx, input.organizationId)
  if (!isValidInterval(input.startsAt, input.endsAt)) {
    throw invalidField('endsAt', 'Return must be after pickup')
  }
  const customer = await requireCustomer(ctx, input.customerId, organizationId)
  const vehicle = input.vehicleId ? await requireVehicle(ctx, input.vehicleId, organizationId) : undefined
  const branchId = vehicle?.branchId ?? customer.branchId
  assertBranchAccess(ctx, branchId, organizationId)
  const returnBranch = await requireBranch(ctx, input.returnBranchId ?? branchId, organizationId)
  const legalEntityId = vehicle?.legalEntityId ?? customer.legalEntityId
  const bookingNumber = await allocateBookingNumber(organizationId)
  const pricing = vehicle
    ? await quoteBooking({
        vehicleId: vehicle.id,
        organizationId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      })
    : undefined
  const booking = await insertBooking({
    organizationId,
    legalEntityId,
    branchId,
    returnBranchId: returnBranch.id,
    bookingNumber,
    customerId: customer.id,
    vehicleId: vehicle?.id,
    vehicleCategory: vehicle?.category,
    customerDisplayName: customer.displayName,
    vehiclePlate: vehicle?.plateNumber,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: BOOKING_STATUSES.DRAFT,
    source: input.source ?? BOOKING_SOURCES.ADMIN,
    sourceChannel: input.sourceChannel,
    campaignReference: input.campaignReference,
    externalReference: input.externalReference,
    notes: input.notes,
    pricing,
    createdBy: ctx.userId,
  })
  await writeHistory(booking, undefined, BOOKING_STATUSES.DRAFT, 'created', ctx.userId)
  await recordAuditEvent({
    action: AUDIT_ACTIONS.BOOKING_CREATE,
    entityType: AUDIT_ENTITY_TYPES.BOOKING,
    entityId: booking.id,
    actorUserId: ctx.userId,
    organizationId,
    branchId,
    metadata: { bookingNumber, source: booking.source },
    meta,
  })
  return toBookingResource(booking)
}

export async function updateDraft(
  ctx: AccessContext,
  id: string,
  input: UpdateBookingBody,
  meta: RequestMeta,
): Promise<BookingResource> {
  assertPermission(ctx, PERMISSIONS.BOOKING_UPDATE)
  const booking = await loadAccessibleBooking(ctx, id)
  if (booking.status !== BOOKING_STATUSES.DRAFT) {
    throw invalidField('status', 'Only a draft booking can be edited')
  }
  if (input.startsAt && input.endsAt && !isValidInterval(input.startsAt, input.endsAt)) {
    throw invalidField('endsAt', 'Return must be after pickup')
  }
  const startsAt = input.startsAt ?? booking.startsAt
  const endsAt = input.endsAt ?? booking.endsAt
  if (!isValidInterval(startsAt, endsAt)) throw invalidField('endsAt', 'Return must be after pickup')

  const customer = input.customerId
    ? await requireCustomer(ctx, input.customerId, booking.organizationId)
    : await requireCustomer(ctx, booking.customerId, booking.organizationId)
  const nextVehicleId = input.vehicleId === null ? undefined : (input.vehicleId ?? booking.vehicleId)
  const vehicle = nextVehicleId
    ? await requireVehicle(ctx, nextVehicleId, booking.organizationId)
    : undefined
  const branchId = vehicle?.branchId ?? customer.branchId
  assertBranchAccess(ctx, branchId, booking.organizationId)
  const returnBranch = await requireBranch(
    ctx,
    input.returnBranchId ?? (vehicle ? vehicle.branchId : booking.returnBranchId),
    booking.organizationId,
  )
  const pricing = vehicle
    ? await quoteBooking({
        vehicleId: vehicle.id,
        organizationId: booking.organizationId,
        startsAt,
        endsAt,
      })
    : undefined
  const updated = await updateDraftBooking(booking.id, booking.organizationId, {
    customerId: customer.id,
    customerDisplayName: customer.displayName,
    vehicleId: vehicle?.id ?? null,
    vehicleCategory: vehicle?.category ?? null,
    vehiclePlate: vehicle?.plateNumber ?? null,
    branchId,
    returnBranchId: returnBranch.id,
    legalEntityId: vehicle?.legalEntityId ?? customer.legalEntityId,
    startsAt,
    endsAt,
    notes: input.notes === undefined ? undefined : input.notes,
    sourceChannel: input.sourceChannel === undefined ? undefined : input.sourceChannel,
    campaignReference: input.campaignReference === undefined ? undefined : input.campaignReference,
    externalReference: input.externalReference === undefined ? undefined : input.externalReference,
    pricing: pricing ?? null,
  })
  if (!updated) throw conflict('Booking changed in the meantime. Reload and retry.')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.BOOKING_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.BOOKING,
    entityId: booking.id,
    actorUserId: ctx.userId,
    organizationId: booking.organizationId,
    branchId: updated.branchId,
    metadata: { bookingNumber: booking.bookingNumber },
    meta,
  })
  return toBookingResource(updated)
}

async function openHold(
  ctx: AccessContext,
  booking: BookingRecord,
  holdMinutes: number | undefined,
  meta: RequestMeta,
): Promise<BookingRecord> {
  if (!booking.vehicleId) throw invalidField('vehicleId', 'Choose a vehicle before placing a hold')
  assertMove(booking.status, BOOKING_STATUSES.HOLD)
  const vehicle = await requireVehicle(ctx, booking.vehicleId, booking.organizationId)
  const expiresAt = holdUntil(new Date(), holdMinutes)
  const held = await withVehicleLock(vehicle.id, async () => {
    const current = await findBookingInOrg(booking.id, booking.organizationId)
    if (!current || current.status !== BOOKING_STATUSES.DRAFT) {
      throw conflict('Booking changed in the meantime. Reload and retry.')
    }
    const pricing = await quoteBooking({
      vehicleId: vehicle.id,
      organizationId: booking.organizationId,
      startsAt: current.startsAt,
      endsAt: current.endsAt,
    })
    const assignment = await reserveWindow(
      vehicle,
      current.startsAt,
      current.endsAt,
      `Booking ${current.bookingNumber}`,
      ctx.userId,
    )
    const updated = await transitionBooking(
      current.id,
      current.organizationId,
      BOOKING_STATUSES.DRAFT,
      BOOKING_STATUSES.HOLD,
      { assignmentId: assignment.id, holdExpiresAt: expiresAt, pricing: pricing ?? null },
    )
    if (!updated) {
      await releaseVehicleAssignment(vehicle.id, vehicle.organizationId, assignment.id)
      throw conflict('Booking changed in the meantime. Reload and retry.')
    }
    return updated
  })
  await writeHistory(held, BOOKING_STATUSES.DRAFT, BOOKING_STATUSES.HOLD, 'hold', ctx.userId)
  await recordAuditEvent({
    action: AUDIT_ACTIONS.BOOKING_HOLD,
    entityType: AUDIT_ENTITY_TYPES.BOOKING,
    entityId: held.id,
    actorUserId: ctx.userId,
    organizationId: held.organizationId,
    branchId: held.branchId,
    metadata: { bookingNumber: held.bookingNumber, holdExpiresAt: held.holdExpiresAt?.toISOString() },
    meta,
  })
  return held
}

export async function placeHold(
  ctx: AccessContext,
  id: string,
  input: HoldBookingBody,
  meta: RequestMeta,
): Promise<BookingResource> {
  assertPermission(ctx, PERMISSIONS.BOOKING_MANAGE_HOLDS)
  const booking = await loadAccessibleBooking(ctx, id)
  return toBookingResource(await openHold(ctx, booking, input.holdMinutes, meta))
}

/** Caller must already hold the vehicle lock. Moves an expired hold at most once. */
async function expireHoldLocked(
  booking: BookingRecord,
  actorUserId: string | undefined,
  meta?: RequestMeta,
): Promise<BookingRecord | null> {
  const current = await findBookingInOrg(booking.id, booking.organizationId)
  if (!current || current.status !== BOOKING_STATUSES.HOLD) return null
  if (current.holdExpiresAt && current.holdExpiresAt.getTime() > Date.now()) return null
  if (current.vehicleId && current.assignmentId) {
    await releaseVehicleAssignment(current.vehicleId, current.organizationId, current.assignmentId)
  }
  const expired = await transitionBooking(
    current.id,
    current.organizationId,
    BOOKING_STATUSES.HOLD,
    BOOKING_STATUSES.EXPIRED,
    { assignmentId: null },
  )
  if (!expired) return null
  await writeHistory(expired, BOOKING_STATUSES.HOLD, BOOKING_STATUSES.EXPIRED, 'hold_expired', actorUserId)
  await recordAuditEvent({
    action: AUDIT_ACTIONS.BOOKING_EXPIRE,
    entityType: AUDIT_ENTITY_TYPES.BOOKING,
    entityId: expired.id,
    actorUserId,
    organizationId: expired.organizationId,
    branchId: expired.branchId,
    metadata: { bookingNumber: expired.bookingNumber },
    meta,
  })
  return expired
}

export async function confirmBooking(
  ctx: AccessContext,
  id: string,
  meta: RequestMeta,
): Promise<BookingResource> {
  assertPermission(ctx, PERMISSIONS.BOOKING_CONFIRM)
  const booking = await loadAccessibleBooking(ctx, id)
  if (booking.status === BOOKING_STATUSES.CONFIRMED) return toBookingResource(booking)
  assertMove(booking.status, BOOKING_STATUSES.CONFIRMED)
  if (!booking.vehicleId) throw invalidField('vehicleId', 'Choose a vehicle before confirming')

  const confirmed = await withVehicleLock(booking.vehicleId, async () => {
    const current = await findBookingInOrg(booking.id, booking.organizationId)
    if (!current) throw notFound('Booking was not found.')
    if (current.status === BOOKING_STATUSES.CONFIRMED) return { booking: current, changed: false }
    if (current.status !== BOOKING_STATUSES.HOLD) {
      throw invalidField(
        'status',
        `A booking cannot move from ${toPublicEnum(current.status)} to confirmed`,
      )
    }
    if (!holdIsOpen(current.status, current.holdExpiresAt, new Date())) {
      await expireHoldLocked(current, ctx.userId, meta)
      throw conflict('The hold has expired. Place a new hold.')
    }
    const updated = await transitionBooking(
      current.id,
      current.organizationId,
      BOOKING_STATUSES.HOLD,
      BOOKING_STATUSES.CONFIRMED,
    )
    if (!updated) throw conflict('Booking changed in the meantime. Reload and retry.')
    return { booking: updated, changed: true }
  })

  if (confirmed.changed) {
    await writeHistory(confirmed.booking, BOOKING_STATUSES.HOLD, BOOKING_STATUSES.CONFIRMED, 'confirmed', ctx.userId)
    await recordAuditEvent({
      action: AUDIT_ACTIONS.BOOKING_CONFIRM,
      entityType: AUDIT_ENTITY_TYPES.BOOKING,
      entityId: confirmed.booking.id,
      actorUserId: ctx.userId,
      organizationId: confirmed.booking.organizationId,
      branchId: confirmed.booking.branchId,
      metadata: { bookingNumber: confirmed.booking.bookingNumber },
      meta,
    })
  }
  return toBookingResource(confirmed.booking)
}

async function releaseWindow(booking: BookingRecord) {
  if (booking.vehicleId && booking.assignmentId) {
    await releaseVehicleAssignment(booking.vehicleId, booking.organizationId, booking.assignmentId)
  }
}

export async function cancelBooking(
  ctx: AccessContext,
  id: string,
  input: CancelBookingBody,
  meta: RequestMeta,
): Promise<BookingResource> {
  assertPermission(ctx, PERMISSIONS.BOOKING_CANCEL)
  const booking = await loadAccessibleBooking(ctx, id)
  if (booking.status === BOOKING_STATUSES.CANCELLED) return toBookingResource(booking)
  assertMove(booking.status, BOOKING_STATUSES.CANCELLED)

  const apply = async (): Promise<{ booking: BookingRecord; from?: BookingStatus }> => {
    const current = await findBookingInOrg(booking.id, booking.organizationId)
    if (!current) throw notFound('Booking was not found.')
    if (current.status === BOOKING_STATUSES.CANCELLED) return { booking: current }
    assertMove(current.status, BOOKING_STATUSES.CANCELLED)
    await releaseWindow(current)
    const updated = await transitionBooking(
      current.id,
      current.organizationId,
      current.status,
      BOOKING_STATUSES.CANCELLED,
      { assignmentId: null },
    )
    if (!updated) throw conflict('Booking changed in the meantime. Reload and retry.')
    return { booking: updated, from: current.status }
  }

  const result = booking.vehicleId ? await withVehicleLock(booking.vehicleId, apply) : await apply()
  if (!result.from) return toBookingResource(result.booking)
  const payload = { updated: result.booking, from: result.from }
  await writeHistory(payload.updated, payload.from, BOOKING_STATUSES.CANCELLED, input.reason, ctx.userId)
  await recordAuditEvent({
    action: AUDIT_ACTIONS.BOOKING_CANCEL,
    entityType: AUDIT_ENTITY_TYPES.BOOKING,
    entityId: payload.updated.id,
    actorUserId: ctx.userId,
    organizationId: payload.updated.organizationId,
    branchId: payload.updated.branchId,
    metadata: { bookingNumber: payload.updated.bookingNumber },
    meta,
  })
  return toBookingResource(payload.updated)
}

export async function releaseHold(
  ctx: AccessContext,
  id: string,
  meta: RequestMeta,
): Promise<BookingResource> {
  assertPermission(ctx, PERMISSIONS.BOOKING_RELEASE)
  const booking = await loadAccessibleBooking(ctx, id)
  if (booking.status === BOOKING_STATUSES.RELEASED) return toBookingResource(booking)
  if (booking.status === BOOKING_STATUSES.CONFIRMED) {
    throw invalidField('status', 'A confirmed booking cannot be released. Cancel it instead.')
  }
  assertMove(booking.status, BOOKING_STATUSES.RELEASED)
  if (!booking.vehicleId) throw invalidField('vehicleId', 'This booking has no vehicle hold')

  const released = await withVehicleLock(booking.vehicleId, async () => {
    const current = await findBookingInOrg(booking.id, booking.organizationId)
    if (!current) throw notFound('Booking was not found.')
    if (current.status === BOOKING_STATUSES.RELEASED) return current
    assertMove(current.status, BOOKING_STATUSES.RELEASED)
    await releaseWindow(current)
    const updated = await transitionBooking(
      current.id,
      current.organizationId,
      BOOKING_STATUSES.HOLD,
      BOOKING_STATUSES.RELEASED,
      { assignmentId: null },
    )
    if (!updated) throw conflict('Booking changed in the meantime. Reload and retry.')
    return updated
  })
  if (booking.status === BOOKING_STATUSES.RELEASED) return toBookingResource(released)
  await writeHistory(released, BOOKING_STATUSES.HOLD, BOOKING_STATUSES.RELEASED, 'released', ctx.userId)
  await recordAuditEvent({
    action: AUDIT_ACTIONS.BOOKING_RELEASE,
    entityType: AUDIT_ENTITY_TYPES.BOOKING,
    entityId: released.id,
    actorUserId: ctx.userId,
    organizationId: released.organizationId,
    branchId: released.branchId,
    metadata: { bookingNumber: released.bookingNumber },
    meta,
  })
  return toBookingResource(released)
}

/**
 * Creates one contract for a confirmed booking. A second call returns the same booking and does
 * not create another contract or another vehicle assignment. The contract service owns the link.
 */
export async function convertBooking(
  ctx: AccessContext,
  id: string,
  meta: RequestMeta,
): Promise<BookingResource> {
  const before = await loadAccessibleBooking(ctx, id)
  const { convertBookingToContract } = await import('../contracts/contract.service.js')
  await convertBookingToContract(ctx, id, meta)
  const booking = await loadAccessibleBooking(ctx, id)
  if (before.status !== BOOKING_STATUSES.CONVERTED && booking.status === BOOKING_STATUSES.CONVERTED) {
    await writeHistory(booking, BOOKING_STATUSES.CONFIRMED, BOOKING_STATUSES.CONVERTED, 'convert', ctx.userId)
    await recordAuditEvent({
      action: AUDIT_ACTIONS.BOOKING_CONVERT,
      entityType: AUDIT_ENTITY_TYPES.BOOKING,
      entityId: booking.id,
      actorUserId: ctx.userId,
      organizationId: booking.organizationId,
      branchId: booking.branchId,
      metadata: { bookingNumber: booking.bookingNumber, conversionKey: booking.conversionKey },
      meta,
    })
  }
  return toBookingResource(booking)
}

export async function searchAvailability(ctx: AccessContext, query: AvailabilityQuery) {
  assertPermission(ctx, PERMISSIONS.BOOKING_VIEW)
  const organizationId = resolveBookingOrganization(ctx, query.organizationId)
  if (query.branchId) assertBranchAccess(ctx, query.branchId, organizationId)
  const orgWide = isOrganizationWide(ctx)
  const branchIds = orgWide ? undefined : [...ctx.branchIds]
  const legalEntityIds = !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined
  const candidates = await findCandidateVehicles({
    organizationId,
    branchId: query.branchId,
    branchIds,
    legalEntityIds,
    category: query.category,
    ownershipType: query.ownershipType,
    limit: 100,
  })
  const blocked = await findOverlappingAssignmentVehicleIds(
    organizationId,
    candidates.map((vehicle) => vehicle.id),
    query.startsAt,
    query.endsAt,
  )
  const items = candidates
    .filter((vehicle) => !blocked.has(vehicle.id))
    .map((vehicle) => ({
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      category: toPublicEnum(vehicle.category),
      status: toPublicEnum(vehicle.status),
      ownershipType: toPublicEnum(vehicle.ownershipType),
      branchId: vehicle.branchId,
    }))
  return { items, startsAt: query.startsAt.toISOString(), endsAt: query.endsAt.toISOString() }
}

export async function listCalendar(ctx: AccessContext, query: CalendarQuery) {
  assertPermission(ctx, PERMISSIONS.BOOKING_VIEW_CALENDAR)
  const organizationId = resolveBookingOrganization(ctx, query.organizationId)
  if (query.branchId) assertBranchAccess(ctx, query.branchId, organizationId)
  const orgWide = isOrganizationWide(ctx)
  let branchIds: string[] | undefined = orgWide ? undefined : [...ctx.branchIds]
  if (query.branchId) branchIds = branchIds ? branchIds.filter((id) => id === query.branchId) : [query.branchId]
  const legalEntityIds = !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined
  const result = await listBookings({
    organizationId,
    skip: 0,
    take: CALENDAR_RESULT_LIMIT,
    status: query.status,
    source: query.source,
    branchIds,
    legalEntityIds,
    vehicleId: query.vehicleId,
    customerId: query.customerId,
    vehicleCategory: query.category,
    overlapFrom: query.from,
    overlapTo: query.to,
    sort: 'startsAt',
    order: 'asc',
  })
  return {
    items: result.items.map(toBookingResource),
    from: query.from.toISOString(),
    to: query.to.toISOString(),
    truncated: result.total > result.items.length,
  }
}

type ClaimModel = Parameters<typeof claimKey>[0]

type ClaimSlot = {
  model: ClaimModel
  filter: Record<string, unknown>
  claimed: boolean
}

async function replayOrClaim(
  model: ClaimModel,
  filter: Record<string, unknown>,
  requestHash: string,
): Promise<{ slot?: ClaimSlot; replay?: BookingRecord; duplicateEvent?: boolean }> {
  const claim = await claimKey(model, filter, requestHash)
  if (claim.outcome === 'mismatch') {
    throw conflict('This key was already used for a different request.')
  }
  if (claim.outcome === 'busy') {
    throw conflict('A request with this key is already in progress. Retry shortly.')
  }
  if (claim.outcome === 'replay') {
    const booking = await findBookingInOrg(claim.bookingId, String(filter.organizationId))
    if (!booking) throw conflict('The original booking for this key could not be loaded.')
    return { replay: booking, duplicateEvent: model === intakeModel() }
  }
  return { slot: { model, filter, claimed: true } }
}

export async function intakeBooking(
  ctx: AccessContext,
  input: IntakeBookingBody,
  meta: RequestMeta,
  headerKey?: string,
): Promise<{ booking: BookingResource; duplicate: boolean }> {
  assertPermission(ctx, PERMISSIONS.BOOKING_CREATE)
  assertPermission(ctx, PERMISSIONS.BOOKING_MANAGE_HOLDS)
  const organizationId = resolveBookingOrganization(ctx, input.organizationId)
  const idempotencyKey = headerKey?.trim() || input.idempotencyKey
  if (!input.externalEventId && !idempotencyKey) {
    throw invalidField('idempotencyKey', 'Provide an idempotency key or an external event id')
  }
  const requestHash = hashRequest({
    customerId: input.customerId,
    vehicleId: input.vehicleId,
    returnBranchId: input.returnBranchId ?? '',
    startsAt: input.startsAt.toISOString(),
    endsAt: input.endsAt.toISOString(),
    source: input.source,
    externalReference: input.externalReference ?? '',
    externalEventId: input.externalEventId ?? '',
    notes: input.notes ?? '',
  })
  const slots: ClaimSlot[] = []
  const orgObject = organizationId
  try {
    if (input.externalEventId) {
      const result = await replayOrClaim(
        intakeModel(),
        { organizationId: orgObject, source: input.source, externalEventId: input.externalEventId },
        requestHash,
      )
      if (result.replay) {
        if (!canAccessBooking(ctx, result.replay)) throw notFound('Booking was not found.')
        await recordAuditEvent({
          action: AUDIT_ACTIONS.BOOKING_WEBHOOK_DUPLICATE,
          entityType: AUDIT_ENTITY_TYPES.BOOKING,
          entityId: result.replay.id,
          actorUserId: ctx.userId,
          organizationId,
          branchId: result.replay.branchId,
          metadata: { bookingNumber: result.replay.bookingNumber, source: input.source },
          meta,
        })
        return { booking: toBookingResource(result.replay), duplicate: true }
      }
      if (result.slot) slots.push(result.slot)
    }
    if (idempotencyKey) {
      const result = await replayOrClaim(
        idempotencyModel(),
        { organizationId: orgObject, key: idempotencyKey },
        requestHash,
      )
      if (result.replay) {
        if (!canAccessBooking(ctx, result.replay)) throw notFound('Booking was not found.')
        return { booking: toBookingResource(result.replay), duplicate: true }
      }
      if (result.slot) slots.push(result.slot)
    }

    const customer = await requireCustomer(ctx, input.customerId, organizationId)
    const vehicle = await requireVehicle(ctx, input.vehicleId, organizationId)
    assertBranchAccess(ctx, vehicle.branchId, organizationId)
    const returnBranch = await requireBranch(ctx, input.returnBranchId ?? vehicle.branchId, organizationId)
    const held = await withVehicleLock(vehicle.id, async () => {
      const bookingNumber = await allocateBookingNumber(organizationId)
      const pricing = await quoteBooking({
        vehicleId: vehicle.id,
        organizationId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      })
      const assignment = await reserveWindow(
        vehicle,
        input.startsAt,
        input.endsAt,
        `Booking ${bookingNumber}`,
        ctx.userId,
      )
      try {
        return await insertBooking({
          organizationId,
          legalEntityId: vehicle.legalEntityId,
          branchId: vehicle.branchId,
          returnBranchId: returnBranch.id,
          bookingNumber,
          customerId: customer.id,
          vehicleId: vehicle.id,
          vehicleCategory: vehicle.category,
          customerDisplayName: customer.displayName,
          vehiclePlate: vehicle.plateNumber,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          status: BOOKING_STATUSES.HOLD,
          source: input.source,
          sourceChannel: input.sourceChannel,
          campaignReference: input.campaignReference,
          externalReference: input.externalReference,
          notes: input.notes,
          pricing,
          holdExpiresAt: holdUntil(new Date(), input.holdMinutes),
          assignmentId: assignment.id,
          createdBy: ctx.userId,
        })
      } catch (error) {
        await releaseVehicleAssignment(vehicle.id, vehicle.organizationId, assignment.id)
        throw error
      }
    })
    await writeHistory(held, undefined, BOOKING_STATUSES.HOLD, 'intake', ctx.userId)
    for (const slot of slots) await attachClaim(slot.model, slot.filter, held.id)
    await recordAuditEvent({
      action: AUDIT_ACTIONS.BOOKING_INTAKE,
      entityType: AUDIT_ENTITY_TYPES.BOOKING,
      entityId: held.id,
      actorUserId: ctx.userId,
      organizationId,
      branchId: held.branchId,
      metadata: { bookingNumber: held.bookingNumber, source: held.source },
      meta,
    })
    return { booking: toBookingResource(held), duplicate: false }
  } catch (error) {
    for (const slot of slots) {
      if (slot.claimed) await releaseClaim(slot.model, slot.filter).catch(() => undefined)
    }
    throw error
  }
}

/** Safe to run repeatedly and from more than one process. Each hold moves at most once. */
export async function expireDueHolds(organizationId?: string): Promise<{ expired: number }> {
  const due = await listExpiredHolds(new Date(), 50, organizationId)
  let expired = 0
  for (const booking of due) {
    try {
      const result = booking.vehicleId
        ? await withVehicleLock(booking.vehicleId, () => expireHoldLocked(booking, undefined))
        : null
      if (result) expired += 1
    } catch (error) {
      logger.warn('Hold expiry skipped', {
        module: 'bookings',
        bookingId: booking.id,
        name: error instanceof Error ? error.name : 'Error',
      })
    }
  }
  return { expired }
}

export async function expireHoldsForCaller(ctx: AccessContext): Promise<{ expired: number }> {
  assertPermission(ctx, PERMISSIONS.BOOKING_RELEASE)
  const organizationId = ctx.accessAllOrganizations ? undefined : ctx.organizationId ?? undefined
  if (!organizationId && !ctx.accessAllOrganizations) {
    throw notFound('Booking was not found.')
  }
  return expireDueHolds(organizationId)
}
