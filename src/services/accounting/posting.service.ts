import {
  DEFAULT_CURRENCY,
  JOURNAL_STATUSES,
  JOURNAL_TYPES,
  SOURCE_MODULES,
  type JournalType,
} from '../../constants/accounting.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import {
  allocateAccountingNumber,
  applyPeriodBalanceDeltas,
  findJournalBySourceKey,
  findOpenPeriodCovering,
  insertJournal,
  listAccountingStatusEvents,
  listJournalLines,
  recordAccountingStatusEvent,
  replaceJournalLines,
  transitionJournal,
  type JournalRecord,
} from '../../repositories/accounting/accounting.repository.js'
import { findAccountById } from '../../repositories/accounting/accounting.repository.js'
import { emitAccountingSourceEvent } from '../../repositories/procurement/procurement.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { normalizeMoney } from '../../utils/money.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess } from '../authorization/authorization.service.js'
import {
  canTransitionJournal,
  isJournalBalanced,
  journalDifference,
  sumCredits,
  sumDebits,
  validateJournalLineAmounts,
} from './accounting-rules.js'
import { loadAccessibleJournal, resolveAccountingOrganization } from './accounting-access.js'
import { toJournalLineResource, toJournalResource } from './accounting.mapper.js'

export type JournalLineBody = {
  accountId: string
  debit?: string
  credit?: string
  description?: string
  customerId?: string
  vendorId?: string
  vehicleId?: string
  contractId?: string
  invoiceId?: string
  paymentId?: string
  reference?: string
}

export type CreateJournalBody = {
  organizationId?: string
  legalEntityId: string
  branchId: string
  journalType: string
  accountingDate: Date
  description: string
  reference?: string
  currency?: string
  sourceModule?: string
  sourceType?: string
  sourceId?: string
  sourceIdempotencyKey?: string
  lines: JournalLineBody[]
}

async function detail(journal: JournalRecord) {
  const [lines, history] = await Promise.all([
    listJournalLines(journal.id),
    listAccountingStatusEvents('journal', journal.id),
  ])
  return {
    ...toJournalResource(journal),
    lines: lines.map(toJournalLineResource),
    history: history.map((row) => ({
      id: String((row as { _id: { toString(): string } })._id),
      fromStatus: (row as { fromStatus?: string }).fromStatus
        ? toPublicEnum(String((row as { fromStatus?: string }).fromStatus))
        : undefined,
      toStatus: toPublicEnum(String((row as { toStatus: string }).toStatus)),
      reason: (row as { reason?: string }).reason ? String((row as { reason?: string }).reason) : undefined,
      createdAt: (row as { createdAt: Date }).createdAt?.toISOString?.(),
    })),
  }
}

async function resolveLines(organizationId: string, branchId: string, lines: JournalLineBody[]) {
  if (lines.length < 2) throw invalidField('lines', 'At least two journal lines are required.')
  const resolved = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    const debit = normalizeMoney(line.debit ?? '0.00')
    const credit = normalizeMoney(line.credit ?? '0.00')
    const issue = validateJournalLineAmounts({ debit, credit })
    if (issue === 'BOTH_DEBIT_AND_CREDIT') {
      throw invalidField(`lines.${index}`, 'A line cannot have both debit and credit.')
    }
    if (issue === 'ZERO_LINE' || issue === 'INVALID_AMOUNT') {
      throw invalidField(`lines.${index}`, 'Each line needs a positive debit or credit amount.')
    }
    const account = await findAccountById(line.accountId)
    if (!account || account.organizationId !== organizationId) {
      throw notFound('Account was not found.')
    }
    if (!account.isActive) throw invalidField(`lines.${index}.accountId`, 'Account is inactive.')
    resolved.push({
      lineNumber: index + 1,
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      debit,
      credit,
      description: line.description,
      branchId,
      customerId: line.customerId,
      vendorId: line.vendorId,
      vehicleId: line.vehicleId,
      contractId: line.contractId,
      invoiceId: line.invoiceId,
      paymentId: line.paymentId,
      reference: line.reference,
    })
  }
  if (!isJournalBalanced(resolved)) {
    throw invalidField('lines', `Journal is not balanced. Difference ${journalDifference(resolved)}.`)
  }
  return resolved
}

export async function createJournalDraft(ctx: AccessContext, body: CreateJournalBody, meta: RequestMeta) {
  const journalType = body.journalType.toUpperCase() as JournalType
  if (journalType === JOURNAL_TYPES.ADJUSTMENT) {
    assertPermission(ctx, PERMISSIONS.ACCOUNTING_ADJUST)
  } else {
    assertPermission(ctx, PERMISSIONS.ACCOUNTING_CREATE)
  }
  const organizationId = resolveAccountingOrganization(ctx, body.organizationId)
  if (!hasBranchAccess(ctx, body.branchId, organizationId)) throw notFound('Branch was not found.')

  if (body.sourceIdempotencyKey) {
    const existing = await findJournalBySourceKey(organizationId, body.sourceIdempotencyKey)
    if (existing) return detail(existing)
  }

  if (!(Object.values(JOURNAL_TYPES) as string[]).includes(journalType)) {
    throw invalidField('journalType', 'Unsupported journal type.')
  }

  const lines = await resolveLines(organizationId, body.branchId, body.lines)
  const totalDebit = sumDebits(lines)
  const totalCredit = sumCredits(lines)

  const journal = await insertJournal({
    organizationId,
    legalEntityId: body.legalEntityId,
    branchId: body.branchId,
    journalType,
    accountingDate: body.accountingDate,
    description: body.description.trim(),
    reference: body.reference,
    sourceModule: (body.sourceModule ?? SOURCE_MODULES.MANUAL).toUpperCase(),
    sourceType: body.sourceType?.toUpperCase(),
    sourceId: body.sourceId,
    sourceIdempotencyKey: body.sourceIdempotencyKey,
    status: JOURNAL_STATUSES.DRAFT,
    currency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    totalDebit,
    totalCredit,
    createdBy: ctx.userId,
  })
  await replaceJournalLines(journal.id, organizationId, lines)
  await recordAccountingStatusEvent({
    entityType: 'journal',
    entityId: journal.id,
    organizationId,
    branchId: body.branchId,
    toStatus: JOURNAL_STATUSES.DRAFT,
    reason: 'created',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId,
    eventType: 'accounting.journal.created',
    entityType: 'journal',
    entityId: journal.id,
    idempotencyKey: `accounting.journal.created:${journal.id}`,
    payload: { journalId: journal.id, totalDebit, totalCredit },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.JOURNAL_CREATE,
    entityType: AUDIT_ENTITY_TYPES.JOURNAL,
    entityId: journal.id,
    actorUserId: ctx.userId,
    organizationId,
    branchId: body.branchId,
    metadata: { journalType, totalDebit, totalCredit },
    meta,
  })
  return detail(journal)
}

export async function updateJournalDraft(
  ctx: AccessContext,
  id: string,
  body: Partial<CreateJournalBody> & { lines?: JournalLineBody[] },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_EDIT)
  const existing = await loadAccessibleJournal(ctx, id)
  if (existing.status !== JOURNAL_STATUSES.DRAFT) {
    throw conflict('Only draft journals can be edited.')
  }
  const lines = body.lines
    ? await resolveLines(existing.organizationId, body.branchId ?? existing.branchId, body.lines)
    : await listJournalLines(existing.id)
  const totalDebit = sumDebits(lines)
  const totalCredit = sumCredits(lines)
  const { updateJournalDraft: persist } = await import('../../repositories/accounting/accounting.repository.js')
  const updated = await persist(existing.id, {
    description: body.description?.trim() ?? existing.description,
    reference: body.reference === undefined ? existing.reference : body.reference,
    accountingDate: body.accountingDate ?? existing.accountingDate,
    journalType: body.journalType ? body.journalType.toUpperCase() : existing.journalType,
    totalDebit,
    totalCredit,
    updatedBy: ctx.userId,
  })
  if (!updated) throw conflict('Journal could not be updated.')
  if (body.lines) await replaceJournalLines(existing.id, existing.organizationId, lines)
  await recordAuditEvent({
    action: AUDIT_ACTIONS.JOURNAL_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.JOURNAL,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    metadata: { fields: Object.keys(body) },
    meta,
  })
  return detail(updated)
}

/**
 * Atomic post: validate period + balance, transition DRAFT→POSTED once, update balances, audit/outbox.
 * Concurrent posts: only one findOneAndUpdate wins.
 */
export async function postJournal(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_POST)
  const existing = await loadAccessibleJournal(ctx, id)
  if (existing.status === JOURNAL_STATUSES.POSTED) return detail(existing)
  if (!canTransitionJournal(existing.status, JOURNAL_STATUSES.POSTED)) {
    throw invalidField('status', `Journal cannot be posted from ${toPublicEnum(existing.status)}`)
  }

  const lines = await listJournalLines(existing.id)
  if (!isJournalBalanced(lines)) {
    throw invalidField('lines', `Journal is not balanced. Difference ${journalDifference(lines)}.`)
  }
  for (const line of lines) {
    const account = await findAccountById(line.accountId)
    if (!account || !account.isActive) throw conflict('Journal references an inactive or missing account.')
  }

  const period = await findOpenPeriodCovering(
    existing.organizationId,
    existing.legalEntityId,
    existing.accountingDate,
  )
  if (!period) {
    throw conflict('No open fiscal period covers the accounting date.')
  }

  const journalNumber = existing.journalNumber ?? (await allocateAccountingNumber(existing.organizationId, 'journal'))
  const posted = await transitionJournal(existing.id, JOURNAL_STATUSES.DRAFT, JOURNAL_STATUSES.POSTED, {
    journalNumber,
    postingDate: new Date(),
    postedAt: new Date(),
    postedBy: ctx.userId,
    fiscalPeriodId: period.id,
  })
  if (!posted) throw conflict('Journal was already posted or is no longer a draft.')

  await applyPeriodBalanceDeltas(
    posted.organizationId,
    posted.legalEntityId,
    period.id,
    posted.branchId,
    lines.map((line) => ({ accountId: line.accountId, debit: line.debit, credit: line.credit })),
  )
  await recordAccountingStatusEvent({
    entityType: 'journal',
    entityId: posted.id,
    organizationId: posted.organizationId,
    branchId: posted.branchId,
    fromStatus: JOURNAL_STATUSES.DRAFT,
    toStatus: JOURNAL_STATUSES.POSTED,
    reason: 'posted',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: posted.organizationId,
    eventType: 'accounting.journal.posted',
    entityType: 'journal',
    entityId: posted.id,
    idempotencyKey: `accounting.journal.posted:${posted.id}`,
    payload: {
      journalId: posted.id,
      journalNumber: posted.journalNumber,
      totalDebit: posted.totalDebit,
      totalCredit: posted.totalCredit,
      fiscalPeriodId: period.id,
    },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.JOURNAL_POST,
    entityType: AUDIT_ENTITY_TYPES.JOURNAL,
    entityId: posted.id,
    actorUserId: ctx.userId,
    organizationId: posted.organizationId,
    branchId: posted.branchId,
    metadata: { journalNumber: posted.journalNumber },
    meta,
  })
  return detail(posted)
}

export async function reverseJournal(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_REVERSE)
  const existing = await loadAccessibleJournal(ctx, id)
  if (existing.status === JOURNAL_STATUSES.REVERSED && existing.reversedJournalId) {
    const reversal = await loadAccessibleJournal(ctx, existing.reversedJournalId)
    return detail(reversal)
  }
  if (!canTransitionJournal(existing.status, JOURNAL_STATUSES.REVERSED)) {
    throw invalidField('status', `Journal cannot be reversed from ${toPublicEnum(existing.status)}`)
  }
  if (!reason.trim()) throw invalidField('reason', 'Reversal reason is required.')

  const period = await findOpenPeriodCovering(
    existing.organizationId,
    existing.legalEntityId,
    new Date(),
  )
  if (!period) throw conflict('No open fiscal period is available for the reversal.')

  const originalLines = await listJournalLines(existing.id)
  const reversalLines = originalLines.map((line, index) => ({
    accountId: line.accountId,
    debit: line.credit,
    credit: line.debit,
    description: `Reversal of ${existing.journalNumber ?? existing.id}: ${line.description ?? ''}`.trim(),
    customerId: line.customerId,
    vendorId: line.vendorId,
    vehicleId: line.vehicleId,
    contractId: line.contractId,
    invoiceId: line.invoiceId,
    paymentId: line.paymentId,
    reference: line.reference,
    lineIndex: index,
  }))

  const idempotencyKey = `reversal:${existing.id}`
  const existingReversal = await findJournalBySourceKey(existing.organizationId, idempotencyKey)
  if (existingReversal) return detail(existingReversal)

  const draft = await createJournalDraft(
    ctx,
    {
      organizationId: existing.organizationId,
      legalEntityId: existing.legalEntityId,
      branchId: existing.branchId,
      journalType: JOURNAL_TYPES.REVERSAL,
      accountingDate: new Date(),
      description: `Reversal of ${existing.journalNumber ?? existing.id}`,
      reference: existing.journalNumber,
      currency: existing.currency,
      sourceModule: SOURCE_MODULES.ACCOUNTING,
      sourceType: 'REVERSAL',
      sourceId: existing.id,
      sourceIdempotencyKey: idempotencyKey,
      lines: reversalLines,
    },
    meta,
  )

  const postedReversal = await postJournal(ctx, draft.id, meta)
  const marked = await transitionJournal(existing.id, JOURNAL_STATUSES.POSTED, JOURNAL_STATUSES.REVERSED, {
    reversedJournalId: postedReversal.id,
    reversalReason: reason,
  })
  if (!marked) throw conflict('Original journal could not be marked reversed.')

  const { JournalEntry } = await import('../../models/accounting.model.js')
  const { toObjectId } = await import('../../repositories/object-id.js')
  await JournalEntry.updateOne(
    { _id: toObjectId(postedReversal.id) },
    { $set: { reversalOfJournalId: toObjectId(existing.id) } },
  )

  await recordAccountingStatusEvent({
    entityType: 'journal',
    entityId: existing.id,
    organizationId: existing.organizationId,
    branchId: existing.branchId,
    fromStatus: JOURNAL_STATUSES.POSTED,
    toStatus: JOURNAL_STATUSES.REVERSED,
    reason,
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: existing.organizationId,
    eventType: 'accounting.journal.reversed',
    entityType: 'journal',
    entityId: existing.id,
    idempotencyKey: `accounting.journal.reversed:${existing.id}`,
    payload: { journalId: existing.id, reversalJournalId: postedReversal.id, reason },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.JOURNAL_REVERSE,
    entityType: AUDIT_ENTITY_TYPES.JOURNAL,
    entityId: existing.id,
    actorUserId: ctx.userId,
    organizationId: existing.organizationId,
    branchId: existing.branchId,
    metadata: { reason, reversalJournalId: postedReversal.id },
    meta,
  })
  return detail(await loadAccessibleJournal(ctx, postedReversal.id))
}

export async function cancelJournal(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_EDIT)
  const existing = await loadAccessibleJournal(ctx, id)
  if (!canTransitionJournal(existing.status, JOURNAL_STATUSES.CANCELLED)) {
    throw invalidField('status', `Journal cannot be cancelled from ${toPublicEnum(existing.status)}`)
  }
  const cancelled = await transitionJournal(existing.id, JOURNAL_STATUSES.DRAFT, JOURNAL_STATUSES.CANCELLED, {
    cancelledReason: reason,
  })
  if (!cancelled) throw conflict('Journal could not be cancelled.')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.JOURNAL_CANCEL,
    entityType: AUDIT_ENTITY_TYPES.JOURNAL,
    entityId: cancelled.id,
    actorUserId: ctx.userId,
    organizationId: cancelled.organizationId,
    branchId: cancelled.branchId,
    metadata: { reason },
    meta,
  })
  return detail(cancelled)
}

export { detail as journalDetail }
