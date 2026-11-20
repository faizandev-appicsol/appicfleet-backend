import { createHash, randomBytes } from 'node:crypto'
import type { InvestorReportKey, InvestorStatus } from '../../constants/investors.js'
import { Investor, InvestorCounter, InvestorInvitation } from '../../models/investor.model.js'
import { toObjectId, toObjectIds } from '../object-id.js'

type LeanDoc = Record<string, unknown> & { _id: { toString(): string } }

export type InvestorScopeRecord = {
  legalEntityIds: string[]
  branchIds: string[]
  vehicleIds: string[]
  reportKeys: InvestorReportKey[]
}

export type InvestorRecord = {
  id: string
  organizationId: string
  userId: string
  investorNumber: string
  displayName: string
  legalName?: string
  contactEmail: string
  phone?: string
  status: InvestorStatus
  accessStartsAt?: Date
  accessEndsAt?: Date
  scope: InvestorScopeRecord
  notes?: string
  createdBy: string
  invitedAt?: Date
  activatedAt?: Date
  suspendedAt?: Date
  revokedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type InvestorInvitationRecord = {
  id: string
  organizationId: string
  investorId: string
  userId: string
  tokenHash: string
  expiresAt: Date
  usedAt?: Date
  revokedAt?: Date
  createdBy: string
  createdAt: Date
}

function strId(value: unknown): string {
  return String(value)
}

function toScope(raw: unknown): InvestorScopeRecord {
  const scope = (raw ?? {}) as Record<string, unknown>
  return {
    legalEntityIds: Array.isArray(scope.legalEntityIds)
      ? scope.legalEntityIds.map((id) => strId(id))
      : [],
    branchIds: Array.isArray(scope.branchIds) ? scope.branchIds.map((id) => strId(id)) : [],
    vehicleIds: Array.isArray(scope.vehicleIds) ? scope.vehicleIds.map((id) => strId(id)) : [],
    reportKeys: Array.isArray(scope.reportKeys)
      ? (scope.reportKeys.map((key) => String(key).toUpperCase()) as InvestorReportKey[])
      : [],
  }
}

function toInvestor(doc: LeanDoc): InvestorRecord {
  return {
    id: doc._id.toString(),
    organizationId: strId(doc.organizationId),
    userId: strId(doc.userId),
    investorNumber: String(doc.investorNumber),
    displayName: String(doc.displayName),
    legalName: doc.legalName ? String(doc.legalName) : undefined,
    contactEmail: String(doc.contactEmail),
    phone: doc.phone ? String(doc.phone) : undefined,
    status: doc.status as InvestorStatus,
    accessStartsAt: doc.accessStartsAt as Date | undefined,
    accessEndsAt: doc.accessEndsAt as Date | undefined,
    scope: toScope(doc.scope),
    notes: doc.notes ? String(doc.notes) : undefined,
    createdBy: strId(doc.createdBy),
    invitedAt: doc.invitedAt as Date | undefined,
    activatedAt: doc.activatedAt as Date | undefined,
    suspendedAt: doc.suspendedAt as Date | undefined,
    revokedAt: doc.revokedAt as Date | undefined,
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}

function toInvitation(doc: LeanDoc): InvestorInvitationRecord {
  return {
    id: doc._id.toString(),
    organizationId: strId(doc.organizationId),
    investorId: strId(doc.investorId),
    userId: strId(doc.userId),
    tokenHash: String(doc.tokenHash),
    expiresAt: doc.expiresAt as Date,
    usedAt: doc.usedAt as Date | undefined,
    revokedAt: doc.revokedAt as Date | undefined,
    createdBy: strId(doc.createdBy),
    createdAt: doc.createdAt as Date,
  }
}

export function hashInvestorInviteToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export function generateInvestorInviteToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url')
  return { raw, hash: hashInvestorInviteToken(raw) }
}

export async function allocateInvestorNumber(organizationId: string): Promise<string> {
  const orgId = toObjectId(organizationId)
  if (!orgId) throw new Error('organizationId is required')
  const counter = await InvestorCounter.findOneAndUpdate(
    { organizationId: orgId, name: 'investor' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean()
  return `INV-${String(counter?.seq ?? 1).padStart(6, '0')}`
}

export async function insertInvestor(
  input: Omit<InvestorRecord, 'id' | 'createdAt' | 'updatedAt' | 'investorNumber'> & {
    investorNumber?: string
  },
): Promise<InvestorRecord> {
  const investorNumber = input.investorNumber ?? (await allocateInvestorNumber(input.organizationId))
  const doc = await Investor.create({
    ...input,
    investorNumber,
    organizationId: toObjectId(input.organizationId),
    userId: toObjectId(input.userId),
    createdBy: toObjectId(input.createdBy),
    scope: {
      legalEntityIds: toObjectIds(input.scope.legalEntityIds),
      branchIds: toObjectIds(input.scope.branchIds),
      vehicleIds: toObjectIds(input.scope.vehicleIds),
      reportKeys: input.scope.reportKeys,
    },
  })
  return toInvestor(doc.toObject() as LeanDoc)
}

export async function findInvestorById(id: string): Promise<InvestorRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Investor.findById(objectId).lean()
  return doc ? toInvestor(doc as LeanDoc) : null
}

export async function findInvestorByUserId(userId: string): Promise<InvestorRecord | null> {
  const objectId = toObjectId(userId)
  if (!objectId) return null
  const doc = await Investor.findOne({ userId: objectId }).lean()
  return doc ? toInvestor(doc as LeanDoc) : null
}

export async function listInvestors(input: {
  organizationId: string
  status?: InvestorStatus
  search?: string
  skip: number
  take: number
  sort: string
  order: 'asc' | 'desc'
}): Promise<{ items: InvestorRecord[]; total: number }> {
  const match: Record<string, unknown> = { organizationId: toObjectId(input.organizationId) }
  if (input.status) match.status = input.status
  if (input.search?.trim()) {
    const q = input.search.trim()
    match.$or = [
      { displayName: { $regex: q, $options: 'i' } },
      { contactEmail: { $regex: q, $options: 'i' } },
      { investorNumber: { $regex: q, $options: 'i' } },
      { legalName: { $regex: q, $options: 'i' } },
    ]
  }
  const sortField = ['displayName', 'createdAt', 'status', 'investorNumber'].includes(input.sort)
    ? input.sort
    : 'createdAt'
  const [items, total] = await Promise.all([
    Investor.find(match)
      .sort({ [sortField]: input.order === 'asc' ? 1 : -1 })
      .skip(input.skip)
      .limit(input.take)
      .lean(),
    Investor.countDocuments(match),
  ])
  return { items: items.map((doc) => toInvestor(doc as LeanDoc)), total }
}

export async function updateInvestor(
  id: string,
  patch: Partial<{
    displayName: string
    legalName: string | null
    contactEmail: string
    phone: string | null
    notes: string | null
    accessStartsAt: Date | null
    accessEndsAt: Date | null
    status: InvestorStatus
    invitedAt: Date | null
    activatedAt: Date | null
    suspendedAt: Date | null
    revokedAt: Date | null
    scope: InvestorScopeRecord
  }>,
): Promise<InvestorRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const $set: Record<string, unknown> = {}
  if (patch.displayName !== undefined) $set.displayName = patch.displayName
  if (patch.legalName !== undefined) $set.legalName = patch.legalName ?? undefined
  if (patch.contactEmail !== undefined) $set.contactEmail = patch.contactEmail
  if (patch.phone !== undefined) $set.phone = patch.phone ?? undefined
  if (patch.notes !== undefined) $set.notes = patch.notes ?? undefined
  if (patch.accessStartsAt !== undefined) $set.accessStartsAt = patch.accessStartsAt ?? undefined
  if (patch.accessEndsAt !== undefined) $set.accessEndsAt = patch.accessEndsAt ?? undefined
  if (patch.status !== undefined) $set.status = patch.status
  if (patch.invitedAt !== undefined) $set.invitedAt = patch.invitedAt ?? undefined
  if (patch.activatedAt !== undefined) $set.activatedAt = patch.activatedAt ?? undefined
  if (patch.suspendedAt !== undefined) $set.suspendedAt = patch.suspendedAt ?? undefined
  if (patch.revokedAt !== undefined) $set.revokedAt = patch.revokedAt ?? undefined
  if (patch.scope) {
    $set.scope = {
      legalEntityIds: toObjectIds(patch.scope.legalEntityIds),
      branchIds: toObjectIds(patch.scope.branchIds),
      vehicleIds: toObjectIds(patch.scope.vehicleIds),
      reportKeys: patch.scope.reportKeys,
    }
  }
  const doc = await Investor.findByIdAndUpdate(objectId, { $set }, { new: true }).lean()
  return doc ? toInvestor(doc as LeanDoc) : null
}

export async function insertInvitation(input: {
  organizationId: string
  investorId: string
  userId: string
  tokenHash: string
  expiresAt: Date
  createdBy: string
}): Promise<InvestorInvitationRecord> {
  const doc = await InvestorInvitation.create({
    organizationId: toObjectId(input.organizationId),
    investorId: toObjectId(input.investorId),
    userId: toObjectId(input.userId),
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    createdBy: toObjectId(input.createdBy),
  })
  return toInvitation(doc.toObject() as LeanDoc)
}

export async function findInvitationByTokenHash(tokenHash: string): Promise<InvestorInvitationRecord | null> {
  const doc = await InvestorInvitation.findOne({ tokenHash }).lean()
  return doc ? toInvitation(doc as LeanDoc) : null
}

export async function markInvitationUsed(id: string): Promise<InvestorInvitationRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await InvestorInvitation.findOneAndUpdate(
    { _id: objectId, usedAt: null, revokedAt: null },
    { $set: { usedAt: new Date() } },
    { new: true },
  ).lean()
  return doc ? toInvitation(doc as LeanDoc) : null
}

export async function revokeOpenInvitations(investorId: string): Promise<number> {
  const objectId = toObjectId(investorId)
  if (!objectId) return 0
  const result = await InvestorInvitation.updateMany(
    { investorId: objectId, usedAt: null, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  )
  return result.modifiedCount
}
