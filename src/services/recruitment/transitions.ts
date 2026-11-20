import {
  APPLICATION_TRANSITIONS,
  OFFER_TRANSITIONS,
  REQUISITION_TRANSITIONS,
  type ApplicationStatus,
  type OfferStatus,
  type RequisitionStatus,
} from '../../constants/recruitment.js'
import { conflict } from '../../utils/httpErrors.js'

export function assertRequisitionTransition(from: string, to: string) {
  const allowed = REQUISITION_TRANSITIONS[from as RequisitionStatus] ?? []
  if (!allowed.includes(to as RequisitionStatus)) {
    throw conflict(`Requisition cannot move from ${from} to ${to}.`)
  }
}

export function assertApplicationTransition(from: string, to: string) {
  const allowed = APPLICATION_TRANSITIONS[from as ApplicationStatus] ?? []
  if (!allowed.includes(to as ApplicationStatus)) {
    throw conflict(`Application cannot move from ${from} to ${to}.`)
  }
}

export function assertOfferTransition(from: string, to: string) {
  const allowed = OFFER_TRANSITIONS[from as OfferStatus] ?? []
  if (!allowed.includes(to as OfferStatus)) {
    throw conflict(`Offer cannot move from ${from} to ${to}.`)
  }
}

export function interviewsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime()
}
