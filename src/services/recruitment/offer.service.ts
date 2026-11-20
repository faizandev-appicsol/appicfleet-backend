import { createHash, randomBytes } from 'node:crypto'
import { APPLICATION_STATUSES, OFFER_STATUSES } from '../../constants/recruitment.js'
import {
  findActiveOfferForApplication,
  findInvitationByTokenHash,
  findOfferById,
  insertCandidateInvitation,
  insertOffer,
  insertOfferApproval,
  listExpiredOpenOffers,
  listOffers,
  markInvitationUsed,
  updateApplication,
  updateOffer,
} from '../../repositories/recruitment/recruitment.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, forbiddenError, invalidField, notFound } from '../../utils/httpErrors.js'
import { toPaginated } from '../../utils/pagination.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
} from '../audit/audit.service.js'
import { getApplication } from './application.service.js'
import { getCandidate } from './candidate.service.js'
import {
  assertBranchScoped,
  branchScopeForList,
  requireRecruitmentOrganization,
} from './recruitment-access.js'
import {
  emitRecruitmentNotificationIntent,
  publishRecruitmentEvent,
} from './recruitment-notifications.js'
import { assertOfferTransition } from './transitions.js'

function parsePage(query: { page?: number; pageSize?: number; limit?: number }) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? query.limit ?? 20)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createOffer(
  ctx: AccessContext,
  body: {
    organizationId?: string
    applicationId: string
    proposedStartDate: string
    employmentType?: string
    baseSalary: string
    allowancesSummary?: string
    benefitsSummary?: string
    currency?: string
    compensationStructureId?: string
    expiresAt: string
    notes?: string
    idempotencyKey?: string
  },
  meta?: RequestMeta,
) {
  const application = await getApplication(ctx, body.applicationId)
  const active = await findActiveOfferForApplication(
    application.organizationId,
    application.id,
  )
  if (active) throw conflict('An active offer already exists for this application.')

  const expiresAt = new Date(body.expiresAt)
  if (expiresAt.getTime() <= Date.now()) {
    throw invalidField('expiresAt', 'Expiry must be in the future.')
  }

  const offer = await insertOffer({
    organizationId: application.organizationId,
    legalEntityId: application.legalEntityId,
    branchId: application.branchId,
    candidateId: application.candidateId,
    applicationId: application.id,
    requisitionId: application.requisitionId,
    proposedStartDate: new Date(body.proposedStartDate),
    employmentType: body.employmentType,
    baseSalary: body.baseSalary,
    allowancesSummary: body.allowancesSummary,
    benefitsSummary: body.benefitsSummary,
    currency: (body.currency ?? 'AED').toUpperCase(),
    compensationStructureId: body.compensationStructureId,
    expiresAt,
    status: OFFER_STATUSES.DRAFT,
    notes: body.notes,
    idempotencyKey: body.idempotencyKey,
    createdBy: ctx.userId,
  })
  if (!offer) throw conflict('Offer could not be created.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.OFFER_CREATED,
    entityType: AUDIT_ENTITY_TYPES.OFFER,
    entityId: offer.id,
    organizationId: application.organizationId,
    branchId: application.branchId,
    metadata: { currency: offer.currency },
    meta,
  })
  return offer
}

export async function submitOfferForApproval(ctx: AccessContext, id: string) {
  const offer = await findOfferById(id)
  if (!offer) throw notFound('Offer was not found.')
  await requireRecruitmentOrganization(ctx, offer.organizationId)
  assertOfferTransition(offer.status, OFFER_STATUSES.PENDING_APPROVAL)
  const updated = await updateOffer(
    id,
    { status: OFFER_STATUSES.PENDING_APPROVAL, updatedBy: ctx.userId },
    [OFFER_STATUSES.DRAFT],
  )
  if (!updated) throw conflict('Offer is not in draft.')
  return updated
}

export async function approveOffer(
  ctx: AccessContext,
  id: string,
  body: { approve: boolean; reason?: string },
  meta?: RequestMeta,
) {
  const offer = await findOfferById(id)
  if (!offer) throw notFound('Offer was not found.')
  await requireRecruitmentOrganization(ctx, offer.organizationId)
  assertBranchScoped(ctx, offer.branchId, offer.organizationId)

  if (body.approve) {
    assertOfferTransition(offer.status, OFFER_STATUSES.APPROVED)
    const updated = await updateOffer(
      id,
      {
        status: OFFER_STATUSES.APPROVED,
        approvedBy: ctx.userId,
        approvedAt: new Date(),
        updatedBy: ctx.userId,
      },
      [OFFER_STATUSES.PENDING_APPROVAL],
    )
    if (!updated) throw conflict('Offer is not pending approval.')
    await insertOfferApproval({
      organizationId: offer.organizationId,
      offerId: id,
      actorUserId: ctx.userId,
      decision: 'APPROVE',
      reason: body.reason,
    })
    await recordAuditEvent({
      action: AUDIT_ACTIONS.OFFER_APPROVED,
      entityType: AUDIT_ENTITY_TYPES.OFFER,
      entityId: id,
      organizationId: offer.organizationId,
      meta,
    })
    await publishRecruitmentEvent({
      organizationId: offer.organizationId,
      eventKey: `recruitment.offer.approved:${id}`,
      eventType: 'recruitment.offer.approved',
      payload: { offerId: id },
    })
    return updated
  }

  assertOfferTransition(offer.status, OFFER_STATUSES.DRAFT)
  const updated = await updateOffer(
    id,
    { status: OFFER_STATUSES.DRAFT, updatedBy: ctx.userId },
    [OFFER_STATUSES.PENDING_APPROVAL],
  )
  if (!updated) throw conflict('Offer is not pending approval.')
  await insertOfferApproval({
    organizationId: offer.organizationId,
    offerId: id,
    actorUserId: ctx.userId,
    decision: 'REJECT',
    reason: body.reason,
  })
  return updated
}

export async function sendOffer(ctx: AccessContext, id: string, meta?: RequestMeta) {
  const offer = await findOfferById(id)
  if (!offer) throw notFound('Offer was not found.')
  await requireRecruitmentOrganization(ctx, offer.organizationId)
  assertBranchScoped(ctx, offer.branchId, offer.organizationId)
  if (offer.status === OFFER_STATUSES.SENT || offer.status === OFFER_STATUSES.VIEWED) {
    return { offer, invitationToken: null as string | null }
  }
  assertOfferTransition(offer.status, OFFER_STATUSES.SENT)
  if (offer.expiresAt.getTime() <= Date.now()) {
    throw conflict('Offer has expired.')
  }

  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = hashToken(rawToken)
  await insertCandidateInvitation({
    organizationId: offer.organizationId,
    candidateId: offer.candidateId,
    offerId: offer.id,
    purpose: 'OFFER_VIEW',
    tokenHash,
    expiresAt: offer.expiresAt,
    createdBy: ctx.userId,
  })

  const updated = await updateOffer(
    id,
    {
      status: OFFER_STATUSES.SENT,
      sentAt: new Date(),
      // Letter content is generated as structured payload; storage key optional.
      offerLetterStorageKey: offer.offerLetterStorageKey ?? `offer-letter:${offer.id}`,
      updatedBy: ctx.userId,
    },
    [OFFER_STATUSES.APPROVED],
  )
  if (!updated) throw conflict('Offer cannot be sent from the current status.')

  await updateApplication(offer.applicationId, {
    status: APPLICATION_STATUSES.OFFER,
    stageCode: 'OFFER',
    updatedBy: ctx.userId,
  })

  await emitRecruitmentNotificationIntent({
    organizationId: offer.organizationId,
    candidateId: offer.candidateId,
    kind: 'recruitment.offer.sent',
    intentKey: `recruitment.offer.sent:${id}`,
    entityType: AUDIT_ENTITY_TYPES.OFFER,
    entityId: id,
    payload: { offerId: id },
    meta,
  })
  await publishRecruitmentEvent({
    organizationId: offer.organizationId,
    eventKey: `recruitment.offer.sent:${id}`,
    eventType: 'recruitment.offer.sent',
    payload: { offerId: id },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.OFFER_SENT,
    entityType: AUDIT_ENTITY_TYPES.OFFER,
    entityId: id,
    organizationId: offer.organizationId,
    meta,
  })

  // Return token once for secure delivery channel; never stored in plaintext.
  return { offer: updated, invitationToken: rawToken }
}

/** Candidate-facing offer decision via invitation token (not ERP session). */
export async function respondToOfferWithToken(
  token: string,
  body: { accept: boolean; notes?: string },
) {
  const tokenHash = hashToken(token)
  const invitation = await findInvitationByTokenHash(tokenHash)
  if (!invitation || invitation.revokedAt) throw forbiddenError('Invitation is invalid.')
  if (invitation.usedAt) throw conflict('Invitation was already used.')
  if (invitation.expiresAt.getTime() < Date.now()) throw conflict('Invitation has expired.')
  if (invitation.purpose !== 'OFFER_VIEW' || !invitation.offerId) {
    throw forbiddenError('Invitation is not valid for offer response.')
  }

  const offer = await findOfferById(invitation.offerId)
  if (!offer || offer.organizationId !== invitation.organizationId) {
    throw notFound('Offer was not found.')
  }
  if (offer.expiresAt.getTime() < Date.now()) {
    await updateOffer(offer.id, { status: OFFER_STATUSES.EXPIRED }, [
      OFFER_STATUSES.SENT,
      OFFER_STATUSES.VIEWED,
    ])
    throw conflict('Offer has expired.')
  }

  const next = body.accept ? OFFER_STATUSES.ACCEPTED : OFFER_STATUSES.REJECTED
  assertOfferTransition(offer.status, next)
  const updated = await updateOffer(
    offer.id,
    {
      status: next,
      respondedAt: new Date(),
      responseNotes: body.notes,
    },
    [OFFER_STATUSES.SENT, OFFER_STATUSES.VIEWED],
  )
  if (!updated) throw conflict('Offer was already decided.')

  await markInvitationUsed(invitation.id)
  await emitRecruitmentNotificationIntent({
    organizationId: offer.organizationId,
    candidateId: offer.candidateId,
    kind: body.accept ? 'recruitment.offer.accepted' : 'recruitment.offer.rejected',
    intentKey: `recruitment.offer.${body.accept ? 'accepted' : 'rejected'}:${offer.id}`,
    entityType: AUDIT_ENTITY_TYPES.OFFER,
    entityId: offer.id,
    payload: { offerId: offer.id },
  })
  await publishRecruitmentEvent({
    organizationId: offer.organizationId,
    eventKey: `recruitment.offer.${body.accept ? 'accepted' : 'rejected'}:${offer.id}`,
    eventType: body.accept ? 'recruitment.offer.accepted' : 'recruitment.offer.rejected',
    payload: { offerId: offer.id },
  })
  await recordAuditEvent({
    action: body.accept ? AUDIT_ACTIONS.OFFER_ACCEPTED : AUDIT_ACTIONS.OFFER_REJECTED,
    entityType: AUDIT_ENTITY_TYPES.OFFER,
    entityId: offer.id,
    organizationId: offer.organizationId,
  })

  return {
    offerId: updated.id,
    status: updated.status,
    candidateId: updated.candidateId,
  }
}

export async function staffRespondToOffer(
  ctx: AccessContext,
  id: string,
  body: { accept: boolean; notes?: string },
  meta?: RequestMeta,
) {
  const offer = await findOfferById(id)
  if (!offer) throw notFound('Offer was not found.')
  await requireRecruitmentOrganization(ctx, offer.organizationId)
  assertBranchScoped(ctx, offer.branchId, offer.organizationId)
  const next = body.accept ? OFFER_STATUSES.ACCEPTED : OFFER_STATUSES.REJECTED
  assertOfferTransition(offer.status, next)
  if (offer.expiresAt.getTime() < Date.now() && body.accept) {
    throw conflict('Offer has expired.')
  }
  const updated = await updateOffer(
    id,
    {
      status: next,
      respondedAt: new Date(),
      responseNotes: body.notes,
      updatedBy: ctx.userId,
    },
    [OFFER_STATUSES.SENT, OFFER_STATUSES.VIEWED, OFFER_STATUSES.APPROVED],
  )
  if (!updated) throw conflict('Offer was already decided.')
  await recordAuditEvent({
    action: body.accept ? AUDIT_ACTIONS.OFFER_ACCEPTED : AUDIT_ACTIONS.OFFER_REJECTED,
    entityType: AUDIT_ENTITY_TYPES.OFFER,
    entityId: id,
    organizationId: offer.organizationId,
    meta,
  })
  return updated
}

export async function getOffer(ctx: AccessContext, id: string) {
  const offer = await findOfferById(id)
  if (!offer) throw notFound('Offer was not found.')
  await requireRecruitmentOrganization(ctx, offer.organizationId)
  assertBranchScoped(ctx, offer.branchId, offer.organizationId)
  return offer
}

export async function listOffersService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    status?: string
    candidateId?: string
    page?: number
    pageSize?: number
  },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listOffers({
    organizationId,
    status: query.status,
    candidateId: query.candidateId,
    branchIds: branchScopeForList(ctx),
    skip,
    limit: pageSize,
  })
  return toPaginated(result.items, page, pageSize, result.total)
}

export async function generateOfferLetterPreview(ctx: AccessContext, id: string) {
  const offer = await getOffer(ctx, id)
  const candidate = await getCandidate(ctx, offer.candidateId)
  // Structured preview only — no raw storage paths; PDF rendering uses existing document infra later.
  return {
    legalEntityId: offer.legalEntityId,
    candidateName: `${candidate.firstName} ${candidate.lastName}`,
    positionId: offer.positionId,
    proposedStartDate: offer.proposedStartDate,
    employmentType: offer.employmentType,
    baseSalary: offer.baseSalary,
    currency: offer.currency,
    allowancesSummary: offer.allowancesSummary,
    benefitsSummary: offer.benefitsSummary,
    expiresAt: offer.expiresAt,
    languages: ['en', 'ar'],
  }
}

/** Idempotent expiry job: SENT/VIEWED offers past expiresAt → EXPIRED. */
export async function expireDueOffers() {
  const due = await listExpiredOpenOffers(100)
  let expired = 0
  for (const offer of due) {
    const updated = await updateOffer(
      offer.id,
      { status: OFFER_STATUSES.EXPIRED },
      [OFFER_STATUSES.SENT, OFFER_STATUSES.VIEWED],
    )
    if (!updated) continue
    expired += 1
    await recordAuditEvent({
      action: AUDIT_ACTIONS.OFFER_EXPIRED,
      entityType: AUDIT_ENTITY_TYPES.OFFER,
      entityId: offer.id,
      organizationId: offer.organizationId,
    })
    await publishRecruitmentEvent({
      organizationId: offer.organizationId,
      eventKey: `recruitment.offer.expired:${offer.id}`,
      eventType: 'recruitment.offer.expired',
      payload: { offerId: offer.id },
    })
  }
  return { scanned: due.length, expired }
}
