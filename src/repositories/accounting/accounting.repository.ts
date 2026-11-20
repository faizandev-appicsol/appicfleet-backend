import type { FilterQuery, SortOrder } from 'mongoose'
import {
  type AccountRole,
  type AccountType,
  type JournalStatus,
  type JournalType,
  type PeriodStatus,
} from '../../constants/accounting.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import {
  AccountBalance,
  AccountMapping,
  AccountingCounter,
  AccountingStatusEvent,
  FiscalPeriod,
  FiscalYear,
  GlAccount,
  JournalEntry,
  JournalLine,
} from '../../models/accounting.model.js'
import { addMoney, normalizeMoney } from '../../utils/money.js'
import { escapeRegex, toObjectId } from '../object-id.js'

type Lean = { _id: { toString(): string }; [key: string]: unknown }

function oid(value?: string) {
  return value ? toObjectId(value) : undefined
}
function sid(value: unknown): string {
  return value && typeof value === 'object' && 'toString' in value ? String(value) : String(value ?? '')
}

export async function allocateAccountingNumber(organizationId: string, name: 'journal'): Promise<string> {
  const orgId = toObjectId(organizationId)
  if (!orgId) throw new Error('Invalid organization')
  const prefixes = { journal: 'JE' } as const
  const doc = await AccountingCounter.findOneAndUpdate(
    { organizationId: orgId, name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  ).lean()
  const seq = Number((doc as { seq?: number } | null)?.seq ?? 1)
  return `${prefixes[name]}-${String(seq).padStart(6, '0')}`
}

export async function recordAccountingStatusEvent(input: {
  entityType: string
  entityId: string
  organizationId: string
  branchId?: string
  fromStatus?: string
  toStatus: string
  reason?: string
  actorUserId: string
}) {
  return AccountingStatusEvent.create({
    entityType: input.entityType,
    entityId: oid(input.entityId),
    organizationId: oid(input.organizationId),
    branchId: oid(input.branchId),
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    reason: input.reason,
    actorUserId: oid(input.actorUserId),
  })
}

export async function listAccountingStatusEvents(entityType: string, entityId: string) {
  const id = toObjectId(entityId)
  if (!id) return []
  return AccountingStatusEvent.find({ entityType, entityId: id }).sort({ createdAt: 1 }).lean()
}

function toAccount(doc: Lean) {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: doc.legalEntityId ? sid(doc.legalEntityId) : undefined,
    code: String(doc.code),
    name: String(doc.name),
    accountType: doc.accountType as AccountType,
    normalBalance: String(doc.normalBalance),
    parentAccountId: doc.parentAccountId ? sid(doc.parentAccountId) : undefined,
    description: doc.description ? String(doc.description) : undefined,
    currency: doc.currency ? String(doc.currency) : undefined,
    isSystem: Boolean(doc.isSystem),
    systemRole: doc.systemRole ? String(doc.systemRole) : undefined,
    isActive: Boolean(doc.isActive),
    createdBy: sid(doc.createdBy),
    updatedBy: doc.updatedBy ? sid(doc.updatedBy) : undefined,
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}
export type GlAccountRecord = ReturnType<typeof toAccount>

export async function insertAccount(input: Omit<GlAccountRecord, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    const doc = await GlAccount.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      parentAccountId: oid(input.parentAccountId),
      createdBy: oid(input.createdBy),
      updatedBy: oid(input.updatedBy),
    })
    return toAccount(doc.toObject() as Lean)
  } catch (error) {
    rethrowDatabaseError(error, 'Account could not be saved. The code may already exist.')
  }
}

export async function findAccountById(id: string): Promise<GlAccountRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await GlAccount.findById(objectId).lean()
  return doc ? toAccount(doc as Lean) : null
}

export async function findAccountByCode(organizationId: string, code: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return null
  const doc = await GlAccount.findOne({ organizationId: orgId, code: code.toUpperCase() }).lean()
  return doc ? toAccount(doc as Lean) : null
}

export async function findAccountByRole(organizationId: string, role: AccountRole) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return null
  const doc = await GlAccount.findOne({ organizationId: orgId, systemRole: role }).lean()
  return doc ? toAccount(doc as Lean) : null
}

export async function updateAccount(id: string, patch: Record<string, unknown>) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await GlAccount.findByIdAndUpdate(
    objectId,
    {
      $set: {
        ...patch,
        parentAccountId: patch.parentAccountId ? oid(String(patch.parentAccountId)) : patch.parentAccountId === null ? null : undefined,
        updatedBy: patch.updatedBy ? oid(String(patch.updatedBy)) : undefined,
      },
    },
    { returnDocument: 'after' },
  ).lean()
  return doc ? toAccount(doc as Lean) : null
}

export async function listAccounts(input: {
  organizationId: string
  skip: number
  take: number
  search?: string
  accountType?: AccountType
  isActive?: boolean
  sort?: 'code' | 'name' | 'accountType' | 'createdAt'
  order?: 'asc' | 'desc'
}) {
  const orgId = toObjectId(input.organizationId)
  if (!orgId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId: orgId }
  if (input.accountType) filter.accountType = input.accountType
  if (input.isActive !== undefined) filter.isActive = input.isActive
  if (input.search?.trim()) {
    const rx = new RegExp(escapeRegex(input.search.trim()), 'i')
    filter.$or = [{ code: rx }, { name: rx }]
  }
  const sortField = input.sort ?? 'code'
  const sort: Record<string, SortOrder> = { [sortField]: input.order === 'desc' ? -1 : 1 }
  const [items, total] = await Promise.all([
    GlAccount.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    GlAccount.countDocuments(filter),
  ])
  return { items: items.map((doc) => toAccount(doc as Lean)), total }
}

export async function listAllAccounts(organizationId: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return []
  const items = await GlAccount.find({ organizationId: orgId }).sort({ code: 1 }).lean()
  return items.map((doc) => toAccount(doc as Lean))
}

function toFiscalYear(doc: Lean) {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: sid(doc.legalEntityId),
    name: String(doc.name),
    startDate: doc.startDate as Date,
    endDate: doc.endDate as Date,
    status: doc.status as PeriodStatus,
    createdBy: sid(doc.createdBy),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}
export type FiscalYearRecord = ReturnType<typeof toFiscalYear>

export async function insertFiscalYear(input: Omit<FiscalYearRecord, 'id' | 'createdAt' | 'updatedAt'>) {
  const doc = await FiscalYear.create({
    ...input,
    organizationId: oid(input.organizationId),
    legalEntityId: oid(input.legalEntityId),
    createdBy: oid(input.createdBy),
  })
  return toFiscalYear(doc.toObject() as Lean)
}

export async function findFiscalYearById(id: string) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await FiscalYear.findById(objectId).lean()
  return doc ? toFiscalYear(doc as Lean) : null
}

export async function listFiscalYears(organizationId: string, legalEntityId?: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return []
  const filter: FilterQuery<unknown> = { organizationId: orgId }
  if (legalEntityId) filter.legalEntityId = toObjectId(legalEntityId)
  const items = await FiscalYear.find(filter).sort({ startDate: -1 }).lean()
  return items.map((doc) => toFiscalYear(doc as Lean))
}

function toFiscalPeriod(doc: Lean) {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: sid(doc.legalEntityId),
    fiscalYearId: sid(doc.fiscalYearId),
    name: String(doc.name),
    periodNumber: Number(doc.periodNumber),
    startDate: doc.startDate as Date,
    endDate: doc.endDate as Date,
    status: doc.status as PeriodStatus,
    closedAt: doc.closedAt as Date | undefined,
    closedBy: doc.closedBy ? sid(doc.closedBy) : undefined,
    closeReason: doc.closeReason ? String(doc.closeReason) : undefined,
    reopenedAt: doc.reopenedAt as Date | undefined,
    reopenedBy: doc.reopenedBy ? sid(doc.reopenedBy) : undefined,
    reopenReason: doc.reopenReason ? String(doc.reopenReason) : undefined,
    createdBy: sid(doc.createdBy),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}
export type FiscalPeriodRecord = ReturnType<typeof toFiscalPeriod>

export async function insertFiscalPeriod(input: Omit<FiscalPeriodRecord, 'id' | 'createdAt' | 'updatedAt' | 'closedAt' | 'closedBy' | 'closeReason' | 'reopenedAt' | 'reopenedBy' | 'reopenReason'>) {
  const doc = await FiscalPeriod.create({
    ...input,
    organizationId: oid(input.organizationId),
    legalEntityId: oid(input.legalEntityId),
    fiscalYearId: oid(input.fiscalYearId),
    createdBy: oid(input.createdBy),
  })
  return toFiscalPeriod(doc.toObject() as Lean)
}

export async function findFiscalPeriodById(id: string) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await FiscalPeriod.findById(objectId).lean()
  return doc ? toFiscalPeriod(doc as Lean) : null
}

export async function findOpenPeriodCovering(organizationId: string, legalEntityId: string, accountingDate: Date) {
  const orgId = toObjectId(organizationId)
  const leId = toObjectId(legalEntityId)
  if (!orgId || !leId) return null
  const doc = await FiscalPeriod.findOne({
    organizationId: orgId,
    legalEntityId: leId,
    status: 'OPEN',
    startDate: { $lte: accountingDate },
    endDate: { $gte: accountingDate },
  }).lean()
  return doc ? toFiscalPeriod(doc as Lean) : null
}

export async function transitionFiscalPeriod(
  id: string,
  from: PeriodStatus,
  to: PeriodStatus,
  meta: Record<string, unknown> = {},
) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await FiscalPeriod.findOneAndUpdate(
    { _id: objectId, status: from },
    { $set: { status: to, ...meta } },
    { returnDocument: 'after' },
  ).lean()
  return doc ? toFiscalPeriod(doc as Lean) : null
}

export async function listFiscalPeriods(organizationId: string, legalEntityId?: string, fiscalYearId?: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return []
  const filter: FilterQuery<unknown> = { organizationId: orgId }
  if (legalEntityId) filter.legalEntityId = toObjectId(legalEntityId)
  if (fiscalYearId) filter.fiscalYearId = toObjectId(fiscalYearId)
  const items = await FiscalPeriod.find(filter).sort({ startDate: 1 }).lean()
  return items.map((doc) => toFiscalPeriod(doc as Lean))
}

function toJournal(doc: Lean) {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    journalNumber: doc.journalNumber ? String(doc.journalNumber) : undefined,
    journalType: doc.journalType as JournalType,
    accountingDate: doc.accountingDate as Date,
    postingDate: doc.postingDate as Date | undefined,
    description: String(doc.description),
    reference: doc.reference ? String(doc.reference) : undefined,
    sourceModule: String(doc.sourceModule),
    sourceType: doc.sourceType ? String(doc.sourceType) : undefined,
    sourceId: doc.sourceId ? sid(doc.sourceId) : undefined,
    sourceIdempotencyKey: doc.sourceIdempotencyKey ? String(doc.sourceIdempotencyKey) : undefined,
    fiscalPeriodId: doc.fiscalPeriodId ? sid(doc.fiscalPeriodId) : undefined,
    status: doc.status as JournalStatus,
    currency: String(doc.currency),
    totalDebit: String(doc.totalDebit),
    totalCredit: String(doc.totalCredit),
    postedAt: doc.postedAt as Date | undefined,
    postedBy: doc.postedBy ? sid(doc.postedBy) : undefined,
    reversedJournalId: doc.reversedJournalId ? sid(doc.reversedJournalId) : undefined,
    reversalOfJournalId: doc.reversalOfJournalId ? sid(doc.reversalOfJournalId) : undefined,
    reversalReason: doc.reversalReason ? String(doc.reversalReason) : undefined,
    cancelledReason: doc.cancelledReason ? String(doc.cancelledReason) : undefined,
    createdBy: sid(doc.createdBy),
    updatedBy: doc.updatedBy ? sid(doc.updatedBy) : undefined,
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}
export type JournalRecord = ReturnType<typeof toJournal>

function toJournalLine(doc: Lean) {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    journalId: sid(doc.journalId),
    lineNumber: Number(doc.lineNumber),
    accountId: sid(doc.accountId),
    accountCode: String(doc.accountCode),
    accountName: String(doc.accountName),
    debit: String(doc.debit),
    credit: String(doc.credit),
    description: doc.description ? String(doc.description) : undefined,
    branchId: doc.branchId ? sid(doc.branchId) : undefined,
    customerId: doc.customerId ? sid(doc.customerId) : undefined,
    vendorId: doc.vendorId ? sid(doc.vendorId) : undefined,
    vehicleId: doc.vehicleId ? sid(doc.vehicleId) : undefined,
    contractId: doc.contractId ? sid(doc.contractId) : undefined,
    invoiceId: doc.invoiceId ? sid(doc.invoiceId) : undefined,
    paymentId: doc.paymentId ? sid(doc.paymentId) : undefined,
    reference: doc.reference ? String(doc.reference) : undefined,
  }
}
export type JournalLineRecord = ReturnType<typeof toJournalLine>

export async function insertJournal(input: Omit<JournalRecord, 'id' | 'createdAt' | 'updatedAt' | 'journalNumber'> & { journalNumber?: string }) {
  try {
    const doc = await JournalEntry.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      sourceId: oid(input.sourceId),
      fiscalPeriodId: oid(input.fiscalPeriodId),
      createdBy: oid(input.createdBy),
      updatedBy: oid(input.updatedBy),
    })
    return toJournal(doc.toObject() as Lean)
  } catch (error) {
    rethrowDatabaseError(error, 'Journal could not be saved. A duplicate source key may exist.')
  }
}

export async function findJournalById(id: string) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await JournalEntry.findById(objectId).lean()
  return doc ? toJournal(doc as Lean) : null
}

export async function findJournalBySourceKey(organizationId: string, sourceIdempotencyKey: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return null
  const doc = await JournalEntry.findOne({ organizationId: orgId, sourceIdempotencyKey }).lean()
  return doc ? toJournal(doc as Lean) : null
}

export async function replaceJournalLines(
  journalId: string,
  organizationId: string,
  lines: Array<{
    lineNumber: number
    accountId: string
    accountCode: string
    accountName: string
    debit: string
    credit: string
    description?: string
    branchId?: string
    customerId?: string
    vendorId?: string
    vehicleId?: string
    contractId?: string
    invoiceId?: string
    paymentId?: string
    reference?: string
  }>,
) {
  const jid = toObjectId(journalId)
  const orgId = toObjectId(organizationId)
  if (!jid || !orgId) return []
  await JournalLine.deleteMany({ journalId: jid })
  if (lines.length === 0) return []
  const docs = await JournalLine.insertMany(
    lines.map((line) => ({
      organizationId: orgId,
      journalId: jid,
      lineNumber: line.lineNumber,
      accountId: oid(line.accountId),
      accountCode: line.accountCode,
      accountName: line.accountName,
      debit: normalizeMoney(line.debit),
      credit: normalizeMoney(line.credit),
      description: line.description,
      branchId: oid(line.branchId),
      customerId: oid(line.customerId),
      vendorId: oid(line.vendorId),
      vehicleId: oid(line.vehicleId),
      contractId: oid(line.contractId),
      invoiceId: oid(line.invoiceId),
      paymentId: oid(line.paymentId),
      reference: line.reference,
    })),
  )
  return docs.map((doc) => toJournalLine(doc.toObject() as Lean))
}

export async function listJournalLines(journalId: string) {
  const id = toObjectId(journalId)
  if (!id) return []
  const docs = await JournalLine.find({ journalId: id }).sort({ lineNumber: 1 }).lean()
  return docs.map((doc) => toJournalLine(doc as Lean))
}

export async function updateJournalDraft(id: string, patch: Record<string, unknown>) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await JournalEntry.findOneAndUpdate(
    { _id: objectId, status: 'DRAFT' },
    { $set: { ...patch, updatedBy: patch.updatedBy ? oid(String(patch.updatedBy)) : undefined } },
    { returnDocument: 'after' },
  ).lean()
  return doc ? toJournal(doc as Lean) : null
}

export async function transitionJournal(
  id: string,
  from: JournalStatus,
  to: JournalStatus,
  meta: Record<string, unknown> = {},
) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const set: Record<string, unknown> = { status: to, ...meta }
  if (meta.postedBy) set.postedBy = oid(String(meta.postedBy))
  if (meta.reversedJournalId) set.reversedJournalId = oid(String(meta.reversedJournalId))
  if (meta.reversalOfJournalId) set.reversalOfJournalId = oid(String(meta.reversalOfJournalId))
  if (meta.fiscalPeriodId) set.fiscalPeriodId = oid(String(meta.fiscalPeriodId))
  const doc = await JournalEntry.findOneAndUpdate(
    { _id: objectId, status: from },
    { $set: set },
    { returnDocument: 'after' },
  ).lean()
  return doc ? toJournal(doc as Lean) : null
}

export async function listJournals(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: JournalStatus
  journalType?: JournalType
  branchId?: string
  legalEntityId?: string
  sourceModule?: string
  accountingFrom?: Date
  accountingTo?: Date
  sort?: 'journalNumber' | 'accountingDate' | 'createdAt' | 'status'
  order?: 'asc' | 'desc'
}) {
  const orgId = toObjectId(input.organizationId)
  if (!orgId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId: orgId }
  if (input.branchId) filter.branchId = toObjectId(input.branchId)
  else if (input.branchIds?.length) filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  if (input.legalEntityId) filter.legalEntityId = toObjectId(input.legalEntityId)
  else if (input.legalEntityIds?.length) {
    filter.legalEntityId = { $in: input.legalEntityIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.status) filter.status = input.status
  if (input.journalType) filter.journalType = input.journalType
  if (input.sourceModule) filter.sourceModule = input.sourceModule.toUpperCase()
  if (input.accountingFrom || input.accountingTo) {
    filter.accountingDate = {}
    if (input.accountingFrom) (filter.accountingDate as Record<string, Date>).$gte = input.accountingFrom
    if (input.accountingTo) (filter.accountingDate as Record<string, Date>).$lte = input.accountingTo
  }
  if (input.search?.trim()) {
    const rx = new RegExp(escapeRegex(input.search.trim()), 'i')
    filter.$or = [{ journalNumber: rx }, { description: rx }, { reference: rx }]
  }
  const sortField = input.sort ?? 'createdAt'
  const sort: Record<string, SortOrder> = { [sortField]: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    JournalEntry.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    JournalEntry.countDocuments(filter),
  ])
  return { items: items.map((doc) => toJournal(doc as Lean)), total }
}

export async function applyPeriodBalanceDeltas(
  organizationId: string,
  legalEntityId: string,
  fiscalPeriodId: string,
  branchId: string,
  lines: Array<{ accountId: string; debit: string; credit: string }>,
) {
  for (const line of lines) {
    const filter = {
      organizationId: oid(organizationId),
      legalEntityId: oid(legalEntityId),
      fiscalPeriodId: oid(fiscalPeriodId),
      accountId: oid(line.accountId),
      branchId: oid(branchId),
    }
    const existing = await AccountBalance.findOne(filter).lean()
    if (!existing) {
      await AccountBalance.create({
        ...filter,
        periodDebit: normalizeMoney(line.debit),
        periodCredit: normalizeMoney(line.credit),
      })
    } else {
      await AccountBalance.updateOne(filter, {
        $set: {
          periodDebit: addMoney(String(existing.periodDebit), normalizeMoney(line.debit)),
          periodCredit: addMoney(String(existing.periodCredit), normalizeMoney(line.credit)),
        },
      })
    }
  }
}

export async function listPeriodBalances(organizationId: string, fiscalPeriodId: string, legalEntityId?: string) {
  const orgId = toObjectId(organizationId)
  const periodId = toObjectId(fiscalPeriodId)
  if (!orgId || !periodId) return []
  const filter: FilterQuery<unknown> = { organizationId: orgId, fiscalPeriodId: periodId }
  if (legalEntityId) filter.legalEntityId = toObjectId(legalEntityId)
  return AccountBalance.find(filter).lean()
}

export async function listLedgerLines(input: {
  organizationId: string
  accountId: string
  from?: Date
  to?: Date
  branchId?: string
  legalEntityId?: string
  customerId?: string
  vendorId?: string
  skip: number
  take: number
}) {
  const orgId = toObjectId(input.organizationId)
  const accountId = toObjectId(input.accountId)
  if (!orgId || !accountId) return { items: [], total: 0 }

  const journalFilter: FilterQuery<unknown> = {
    organizationId: orgId,
    status: { $in: ['POSTED', 'REVERSED'] },
  }
  if (input.branchId) journalFilter.branchId = toObjectId(input.branchId)
  if (input.legalEntityId) journalFilter.legalEntityId = toObjectId(input.legalEntityId)
  if (input.from || input.to) {
    journalFilter.accountingDate = {}
    if (input.from) (journalFilter.accountingDate as Record<string, Date>).$gte = input.from
    if (input.to) (journalFilter.accountingDate as Record<string, Date>).$lte = input.to
  }
  const journals = await JournalEntry.find(journalFilter).select({ _id: 1, accountingDate: 1, journalNumber: 1, description: 1, reference: 1, status: 1 }).lean()
  const journalIds = journals.map((j) => j._id)
  if (journalIds.length === 0) return { items: [], total: 0 }

  const lineFilter: FilterQuery<unknown> = {
    organizationId: orgId,
    accountId,
    journalId: { $in: journalIds },
  }
  if (input.customerId) lineFilter.customerId = toObjectId(input.customerId)
  if (input.vendorId) lineFilter.vendorId = toObjectId(input.vendorId)

  const [lines, total] = await Promise.all([
    JournalLine.find(lineFilter).sort({ createdAt: 1 }).skip(input.skip).limit(input.take).lean(),
    JournalLine.countDocuments(lineFilter),
  ])
  const journalMap = new Map(journals.map((j) => [String(j._id), j]))
  return {
    items: lines.map((line) => {
      const journal = journalMap.get(sid(line.journalId))
      return {
        ...toJournalLine(line as Lean),
        accountingDate: journal?.accountingDate as Date | undefined,
        journalNumber: journal?.journalNumber ? String(journal.journalNumber) : undefined,
        journalDescription: journal?.description ? String(journal.description) : undefined,
        journalReference: journal?.reference ? String(journal.reference) : undefined,
        journalStatus: journal?.status ? String(journal.status) : undefined,
      }
    }),
    total,
  }
}

export async function upsertAccountMapping(input: {
  organizationId: string
  legalEntityId: string
  role: AccountRole
  accountId: string
  updatedBy: string
}) {
  const doc = await AccountMapping.findOneAndUpdate(
    {
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      role: input.role,
    },
    {
      $set: {
        accountId: oid(input.accountId),
        updatedBy: oid(input.updatedBy),
      },
    },
    { upsert: true, returnDocument: 'after' },
  ).lean()
  return doc
}

export async function listAccountMappings(organizationId: string, legalEntityId: string) {
  const orgId = toObjectId(organizationId)
  const leId = toObjectId(legalEntityId)
  if (!orgId || !leId) return []
  return AccountMapping.find({ organizationId: orgId, legalEntityId: leId }).lean()
}

export async function findMappedAccountId(organizationId: string, legalEntityId: string, role: AccountRole) {
  const orgId = toObjectId(organizationId)
  const leId = toObjectId(legalEntityId)
  if (!orgId || !leId) return null
  const mapping = await AccountMapping.findOne({ organizationId: orgId, legalEntityId: leId, role }).lean()
  if (mapping?.accountId) return sid(mapping.accountId)
  const byRole = await findAccountByRole(organizationId, role)
  return byRole?.id ?? null
}
