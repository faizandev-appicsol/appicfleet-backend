import { DEFAULT_ADMIN_FEE, FINE_STATUSES, TOLL_STATUSES } from '../../constants/charges.js'
import { CHARGE_KINDS } from '../../constants/contracts.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  findRecoveryBySource,
  insertDispute,
  insertRecovery,
  listDisputes,
  recordChargeStatusEvent,
  transitionFine,
  transitionToll,
  updateDispute,
  updateFine,
  updateToll,
} from '../../repositories/charges/charges.repository.js'
import { insertCharge } from '../../repositories/contracts/contract.repository.js'
import { emitAccountingSourceEvent } from '../../repositories/procurement/procurement.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict } from '../../utils/httpErrors.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { loadAccessibleFine, loadAccessibleToll } from './charges-access.js'
import { calculateRecoveryAmount } from './charges-rules.js'

type RecoverBody = {
  policy?: 'EXACT' | 'EXACT_PLUS_ADMIN'
  adminFee?: string
}

export async function recoverFine(ctx: AccessContext, id: string, body: RecoverBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.FINE_RECOVER)
  const fine = await loadAccessibleFine(ctx, id)
  if (fine.status !== FINE_STATUSES.APPROVED && fine.status !== FINE_STATUSES.RECOVERY_PENDING) {
    throw conflict('Only approved fines can be recovered.')
  }
  if (!fine.contractId || !fine.customerId) throw conflict('Fine has no assigned contract/customer.')

  const existing = await findRecoveryBySource(fine.organizationId, 'FINE', fine.id)
  if (existing) {
    return {
      id: String(existing._id),
      sourceKind: 'fine',
      sourceId: fine.id,
      recoveryAmount: String(existing.recoveryAmount),
      contractChargeId: existing.contractChargeId ? String(existing.contractChargeId) : undefined,
      duplicate: true,
    }
  }

  const policy = body.policy ?? 'EXACT'
  const money = calculateRecoveryAmount(fine.amount, policy, body.adminFee ?? DEFAULT_ADMIN_FEE)
  const idempotencyKey = `fine.recovery:${fine.id}`

  const pending = await transitionFine(fine.id, fine.status, FINE_STATUSES.RECOVERY_PENDING, {})
  if (!pending && fine.status !== FINE_STATUSES.RECOVERY_PENDING) {
    throw conflict('Fine could not enter recovery.')
  }

  const charge = await insertCharge({
    contractId: fine.contractId,
    organizationId: fine.organizationId,
    kind: CHARGE_KINDS.FINE_RECOVERY,
    sourceId: fine.id,
    currency: fine.currency,
    unitAmount: money.recoveryAmount,
    quantityDays: 1,
    totalAmount: money.recoveryAmount,
    rateType: 'FIXED',
    periodStart: fine.eventAt,
    periodEnd: fine.eventAt,
    createdBy: ctx.userId,
  })

  const recovery = await insertRecovery({
    organizationId: fine.organizationId,
    legalEntityId: fine.legalEntityId,
    branchId: fine.branchId,
    sourceKind: 'FINE',
    sourceId: fine.id,
    contractId: fine.contractId,
    customerId: fine.customerId,
    vehicleId: fine.vehicleId,
    currency: fine.currency,
    authorityAmount: fine.amount,
    recoveryAmount: money.recoveryAmount,
    adminFee: money.adminFee,
    policy,
    contractChargeId: String(charge._id),
    status: 'CHARGED',
    idempotencyKey,
    createdBy: ctx.userId,
  })

  await updateFine(fine.id, {
    status: FINE_STATUSES.RECOVERED,
    recoveryId: String(recovery!._id),
    recoveryAmount: money.recoveryAmount,
  })
  await recordChargeStatusEvent({
    entityType: 'fine',
    entityId: fine.id,
    organizationId: fine.organizationId,
    branchId: fine.branchId,
    fromStatus: FINE_STATUSES.RECOVERY_PENDING,
    toStatus: FINE_STATUSES.RECOVERED,
    reason: 'recovered',
    actorUserId: ctx.userId,
  })

  await emitAccountingSourceEvent({
    organizationId: fine.organizationId,
    eventType: 'fine.recovered',
    entityType: 'fine',
    entityId: fine.id,
    idempotencyKey: `fine.recovered:${fine.id}`,
    payload: {
      fineId: fine.id,
      recoveryId: String(recovery!._id),
      contractChargeId: String(charge._id),
      recoveryAmount: money.recoveryAmount,
    },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.FINE_RECOVER,
    entityType: AUDIT_ENTITY_TYPES.FINE,
    entityId: fine.id,
    actorUserId: ctx.userId,
    organizationId: fine.organizationId,
    branchId: fine.branchId,
    metadata: { recoveryId: String(recovery!._id), recoveryAmount: money.recoveryAmount },
    meta,
  })

  return {
    id: String(recovery!._id),
    sourceKind: 'fine',
    sourceId: fine.id,
    recoveryAmount: money.recoveryAmount,
    contractChargeId: String(charge._id),
    duplicate: false,
  }
}

export async function recoverToll(ctx: AccessContext, id: string, body: RecoverBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.TOLL_RECOVER)
  const toll = await loadAccessibleToll(ctx, id)
  if (toll.status !== TOLL_STATUSES.APPROVED && toll.status !== TOLL_STATUSES.RECOVERY_PENDING) {
    throw conflict('Only approved tolls can be recovered.')
  }
  if (!toll.contractId || !toll.customerId) throw conflict('Toll has no assigned contract/customer.')

  const existing = await findRecoveryBySource(toll.organizationId, 'TOLL', toll.id)
  if (existing) {
    return {
      id: String(existing._id),
      sourceKind: 'toll',
      sourceId: toll.id,
      recoveryAmount: String(existing.recoveryAmount),
      contractChargeId: existing.contractChargeId ? String(existing.contractChargeId) : undefined,
      duplicate: true,
    }
  }

  const policy = body.policy ?? 'EXACT'
  const money = calculateRecoveryAmount(toll.amount, policy, body.adminFee ?? DEFAULT_ADMIN_FEE)
  const idempotencyKey = `toll.recovery:${toll.id}`

  await transitionToll(toll.id, toll.status, TOLL_STATUSES.RECOVERY_PENDING, {})
  const charge = await insertCharge({
    contractId: toll.contractId,
    organizationId: toll.organizationId,
    kind: CHARGE_KINDS.TOLL_RECOVERY,
    sourceId: toll.id,
    currency: toll.currency,
    unitAmount: money.recoveryAmount,
    quantityDays: 1,
    totalAmount: money.recoveryAmount,
    rateType: 'FIXED',
    periodStart: toll.eventAt,
    periodEnd: toll.eventAt,
    createdBy: ctx.userId,
  })
  const recovery = await insertRecovery({
    organizationId: toll.organizationId,
    legalEntityId: toll.legalEntityId,
    branchId: toll.branchId,
    sourceKind: 'TOLL',
    sourceId: toll.id,
    contractId: toll.contractId,
    customerId: toll.customerId,
    vehicleId: toll.vehicleId,
    currency: toll.currency,
    authorityAmount: toll.amount,
    recoveryAmount: money.recoveryAmount,
    adminFee: money.adminFee,
    policy,
    contractChargeId: String(charge._id),
    status: 'CHARGED',
    idempotencyKey,
    createdBy: ctx.userId,
  })
  await updateToll(toll.id, {
    status: TOLL_STATUSES.RECOVERED,
    recoveryId: String(recovery!._id),
    recoveryAmount: money.recoveryAmount,
  })
  await emitAccountingSourceEvent({
    organizationId: toll.organizationId,
    eventType: 'toll.recovered',
    entityType: 'toll',
    entityId: toll.id,
    idempotencyKey: `toll.recovered:${toll.id}`,
    payload: { tollId: toll.id, recoveryId: String(recovery!._id), recoveryAmount: money.recoveryAmount },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.TOLL_RECOVER,
    entityType: AUDIT_ENTITY_TYPES.TOLL,
    entityId: toll.id,
    actorUserId: ctx.userId,
    organizationId: toll.organizationId,
    branchId: toll.branchId,
    metadata: { recoveryId: String(recovery!._id) },
    meta,
  })
  return {
    id: String(recovery!._id),
    sourceKind: 'toll',
    sourceId: toll.id,
    recoveryAmount: money.recoveryAmount,
    contractChargeId: String(charge._id),
    duplicate: false,
  }
}

export async function disputeFine(
  ctx: AccessContext,
  id: string,
  body: { reason: string; description?: string; evidenceKey?: string },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.FINE_DISPUTE)
  const fine = await loadAccessibleFine(ctx, id)
  if (![FINE_STATUSES.ASSIGNED, FINE_STATUSES.APPROVED, FINE_STATUSES.RECOVERY_PENDING].includes(fine.status as typeof FINE_STATUSES.ASSIGNED)) {
    throw conflict('Fine cannot be disputed in its current status.')
  }
  const dispute = await insertDispute({
    organizationId: fine.organizationId,
    sourceKind: 'FINE',
    sourceId: fine.id,
    status: 'OPEN',
    reason: body.reason,
    description: body.description,
    evidenceKey: body.evidenceKey,
    createdBy: ctx.userId,
  })
  await transitionFine(fine.id, fine.status, FINE_STATUSES.DISPUTED, {})
  await recordChargeStatusEvent({
    entityType: 'fine',
    entityId: fine.id,
    organizationId: fine.organizationId,
    branchId: fine.branchId,
    fromStatus: fine.status,
    toStatus: FINE_STATUSES.DISPUTED,
    reason: body.reason,
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: fine.organizationId,
    eventType: 'fine.disputed',
    entityType: 'fine',
    entityId: fine.id,
    idempotencyKey: `fine.disputed:${fine.id}:${String(dispute._id)}`,
    payload: { fineId: fine.id, disputeId: String(dispute._id), reason: body.reason },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.FINE_DISPUTE,
    entityType: AUDIT_ENTITY_TYPES.FINE,
    entityId: fine.id,
    actorUserId: ctx.userId,
    organizationId: fine.organizationId,
    branchId: fine.branchId,
    metadata: { disputeId: String(dispute._id) },
    meta,
  })
  return { id: String(dispute._id), status: 'open' }
}

export async function resolveFineDispute(
  ctx: AccessContext,
  id: string,
  body: { disputeId: string; decision: 'accepted' | 'rejected'; resolution?: string },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.FINE_REVIEW)
  const fine = await loadAccessibleFine(ctx, id)
  const disputes = await listDisputes(fine.organizationId, 'FINE', fine.id)
  const dispute = disputes.find((row) => String(row._id) === body.disputeId)
  if (!dispute) throw conflict('Dispute was not found.')
  const status = body.decision === 'accepted' ? 'ACCEPTED' : 'REJECTED'
  await updateDispute(body.disputeId, {
    status,
    resolution: body.resolution,
    resolvedBy: ctx.userId,
    resolvedAt: new Date(),
  })
  if (body.decision === 'accepted') {
    await transitionFine(fine.id, fine.status, FINE_STATUSES.WAIVED, {
      waivedReason: body.resolution ?? 'Dispute accepted',
    })
  } else if (fine.status === FINE_STATUSES.DISPUTED) {
    await transitionFine(fine.id, FINE_STATUSES.DISPUTED, FINE_STATUSES.ASSIGNED, {})
  }
  await recordAuditEvent({
    action: AUDIT_ACTIONS.FINE_DISPUTE,
    entityType: AUDIT_ENTITY_TYPES.FINE,
    entityId: fine.id,
    actorUserId: ctx.userId,
    organizationId: fine.organizationId,
    branchId: fine.branchId,
    metadata: { disputeId: body.disputeId, decision: body.decision },
    meta,
  })
  return { id: body.disputeId, status: status.toLowerCase() }
}
