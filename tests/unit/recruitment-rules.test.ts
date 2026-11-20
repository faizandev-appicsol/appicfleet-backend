import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  APPLICATION_STATUSES,
  OFFER_STATUSES,
  REQUISITION_STATUSES,
} from '../../src/constants/recruitment.js'
import { AppError } from '../../src/exceptions/AppError.js'
import {
  assertApplicationTransition,
  assertOfferTransition,
  assertRequisitionTransition,
  interviewsOverlap,
} from '../../src/services/recruitment/transitions.js'

describe('requisition transitions', () => {
  it('allows draft → pending → approved → open', () => {
    assert.doesNotThrow(() =>
      assertRequisitionTransition(REQUISITION_STATUSES.DRAFT, REQUISITION_STATUSES.PENDING_APPROVAL),
    )
    assert.doesNotThrow(() =>
      assertRequisitionTransition(
        REQUISITION_STATUSES.PENDING_APPROVAL,
        REQUISITION_STATUSES.APPROVED,
      ),
    )
    assert.doesNotThrow(() =>
      assertRequisitionTransition(REQUISITION_STATUSES.APPROVED, REQUISITION_STATUSES.OPEN),
    )
  })

  it('rejects closed → open and draft → open', () => {
    assert.throws(
      () => assertRequisitionTransition(REQUISITION_STATUSES.CLOSED, REQUISITION_STATUSES.OPEN),
      AppError,
    )
    assert.throws(
      () => assertRequisitionTransition(REQUISITION_STATUSES.DRAFT, REQUISITION_STATUSES.OPEN),
      AppError,
    )
  })
})

describe('application transitions', () => {
  it('allows pipeline forward moves', () => {
    assert.doesNotThrow(() =>
      assertApplicationTransition(APPLICATION_STATUSES.NEW, APPLICATION_STATUSES.SCREENING),
    )
    assert.doesNotThrow(() =>
      assertApplicationTransition(APPLICATION_STATUSES.SCREENING, APPLICATION_STATUSES.SHORTLISTED),
    )
    assert.doesNotThrow(() =>
      assertApplicationTransition(APPLICATION_STATUSES.SHORTLISTED, APPLICATION_STATUSES.INTERVIEW),
    )
    assert.doesNotThrow(() =>
      assertApplicationTransition(APPLICATION_STATUSES.INTERVIEW, APPLICATION_STATUSES.OFFER),
    )
    assert.doesNotThrow(() =>
      assertApplicationTransition(APPLICATION_STATUSES.OFFER, APPLICATION_STATUSES.HIRED),
    )
  })

  it('rejects hired → interview and new → hired', () => {
    assert.throws(
      () =>
        assertApplicationTransition(APPLICATION_STATUSES.HIRED, APPLICATION_STATUSES.INTERVIEW),
      AppError,
    )
    assert.throws(
      () => assertApplicationTransition(APPLICATION_STATUSES.NEW, APPLICATION_STATUSES.HIRED),
      AppError,
    )
  })
})

describe('offer transitions', () => {
  it('allows draft → pending → approved → sent → accepted', () => {
    assert.doesNotThrow(() =>
      assertOfferTransition(OFFER_STATUSES.DRAFT, OFFER_STATUSES.PENDING_APPROVAL),
    )
    assert.doesNotThrow(() =>
      assertOfferTransition(OFFER_STATUSES.PENDING_APPROVAL, OFFER_STATUSES.APPROVED),
    )
    assert.doesNotThrow(() =>
      assertOfferTransition(OFFER_STATUSES.APPROVED, OFFER_STATUSES.SENT),
    )
    assert.doesNotThrow(() =>
      assertOfferTransition(OFFER_STATUSES.SENT, OFFER_STATUSES.ACCEPTED),
    )
  })

  it('rejects accepted → sent and draft → accepted', () => {
    assert.throws(
      () => assertOfferTransition(OFFER_STATUSES.ACCEPTED, OFFER_STATUSES.SENT),
      AppError,
    )
    assert.throws(
      () => assertOfferTransition(OFFER_STATUSES.DRAFT, OFFER_STATUSES.ACCEPTED),
      AppError,
    )
  })

  it('allows sent → expired', () => {
    assert.doesNotThrow(() =>
      assertOfferTransition(OFFER_STATUSES.SENT, OFFER_STATUSES.EXPIRED),
    )
  })
})

describe('interview overlap detection', () => {
  it('detects overlapping windows', () => {
    const aStart = new Date('2026-04-01T09:00:00.000Z')
    const aEnd = new Date('2026-04-01T10:00:00.000Z')
    const bStart = new Date('2026-04-01T09:30:00.000Z')
    const bEnd = new Date('2026-04-01T10:30:00.000Z')
    assert.equal(interviewsOverlap(aStart, aEnd, bStart, bEnd), true)
  })

  it('allows adjacent non-overlapping windows', () => {
    const aStart = new Date('2026-04-01T09:00:00.000Z')
    const aEnd = new Date('2026-04-01T10:00:00.000Z')
    const bStart = new Date('2026-04-01T10:00:00.000Z')
    const bEnd = new Date('2026-04-01T11:00:00.000Z')
    assert.equal(interviewsOverlap(aStart, aEnd, bStart, bEnd), false)
  })
})
