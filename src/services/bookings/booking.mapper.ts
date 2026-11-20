import { toPublicEnum } from '../../constants/vehicles.js'
import type { BookingRecord, StatusEventRecord } from '../../repositories/bookings/booking.repository.js'

export type BookingResource = {
  id: string
  bookingNumber: string
  organizationId: string
  legalEntityId: string
  branchId: string
  returnBranchId: string
  customerId: string
  customerDisplayName: string
  vehicleId?: string
  vehiclePlate?: string
  vehicleCategory?: string
  startsAt: string
  endsAt: string
  status: string
  source: string
  sourceChannel?: string
  campaignReference?: string
  externalReference?: string
  notes?: string
  pricing?: {
    currency: string
    unitAmount: string
    quantityDays: number
    totalAmount: string
    rateType: string
  }
  holdExpiresAt?: string
  /** Present once a future contract conversion has been recorded. No contract is created here. */
  conversionKey?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export function toBookingResource(booking: BookingRecord): BookingResource {
  return {
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    organizationId: booking.organizationId,
    legalEntityId: booking.legalEntityId,
    branchId: booking.branchId,
    returnBranchId: booking.returnBranchId,
    customerId: booking.customerId,
    customerDisplayName: booking.customerDisplayName,
    vehicleId: booking.vehicleId,
    vehiclePlate: booking.vehiclePlate,
    vehicleCategory: booking.vehicleCategory ? toPublicEnum(booking.vehicleCategory) : undefined,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    status: toPublicEnum(booking.status),
    source: toPublicEnum(booking.source),
    sourceChannel: booking.sourceChannel,
    campaignReference: booking.campaignReference,
    externalReference: booking.externalReference,
    notes: booking.notes,
    pricing: booking.pricing ? { ...booking.pricing, rateType: toPublicEnum(booking.pricing.rateType) } : undefined,
    holdExpiresAt: booking.holdExpiresAt?.toISOString(),
    conversionKey: booking.conversionKey,
    createdBy: booking.createdBy,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  }
}

export type StatusEventResource = {
  id: string
  fromStatus?: string
  toStatus: string
  reason?: string
  actorUserId?: string
  createdAt: string
}

export function toStatusEventResource(event: StatusEventRecord): StatusEventResource {
  return {
    id: event.id,
    fromStatus: event.fromStatus ? toPublicEnum(event.fromStatus) : undefined,
    toStatus: toPublicEnum(event.toStatus),
    reason: event.reason,
    actorUserId: event.actorUserId,
    createdAt: event.createdAt.toISOString(),
  }
}
