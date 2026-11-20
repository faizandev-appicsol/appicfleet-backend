import {
  tryInsertRecruitmentNotificationIntent,
  tryInsertRecruitmentOutboxEvent,
} from '../../repositories/recruitment/recruitment.repository.js'
import type { RequestMeta } from '../../types/access.js'
import {
  AUDIT_ACTIONS,
  recordAuditEvent,
  type AuditAction,
} from '../audit/audit.service.js'

const KIND_AUDIT: Record<string, AuditAction> = {
  'recruitment.application.created': AUDIT_ACTIONS.APPLICATION_CREATED,
  'recruitment.interview.scheduled': AUDIT_ACTIONS.INTERVIEW_CREATED,
  'recruitment.offer.sent': AUDIT_ACTIONS.OFFER_SENT,
  'recruitment.offer.accepted': AUDIT_ACTIONS.OFFER_ACCEPTED,
  'recruitment.onboarding.started': AUDIT_ACTIONS.ONBOARDING_CREATED,
  'recruitment.onboarding.completed': AUDIT_ACTIONS.ONBOARDING_COMPLETED,
  'recruitment.candidate.hired': AUDIT_ACTIONS.CANDIDATE_CONVERTED_TO_EMPLOYEE,
}

/**
 * Module 15 notification providers are not wired yet.
 * Persist idempotent intents + outbox events. Never put salary amounts or
 * interview feedback content in notification payloads.
 */
export async function emitRecruitmentNotificationIntent(input: {
  organizationId: string
  candidateId?: string
  kind: string
  intentKey: string
  payload?: Record<string, unknown>
  meta?: RequestMeta
  entityType?: string
  entityId?: string
}) {
  const inserted = await tryInsertRecruitmentNotificationIntent({
    organizationId: input.organizationId,
    candidateId: input.candidateId,
    intentKey: input.intentKey,
    kind: input.kind,
    payload: input.payload,
  })
  if (!inserted) return false

  await tryInsertRecruitmentOutboxEvent({
    organizationId: input.organizationId,
    eventKey: `evt:${input.intentKey}`,
    eventType: input.kind,
    payload: { candidateId: input.candidateId, ...input.payload },
  })

  const action = KIND_AUDIT[input.kind]
  if (action) {
    await recordAuditEvent({
      action,
      entityType: input.entityType ?? 'candidate',
      entityId: input.entityId ?? input.candidateId,
      organizationId: input.organizationId,
      metadata: { intentKey: input.intentKey, kind: input.kind, notificationPending: true },
      meta: input.meta,
    })
  }
  return true
}

export async function publishRecruitmentEvent(input: {
  organizationId: string
  eventKey: string
  eventType: string
  payload?: Record<string, unknown>
}) {
  return tryInsertRecruitmentOutboxEvent(input)
}
