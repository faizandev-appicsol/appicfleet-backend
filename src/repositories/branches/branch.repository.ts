import type { FilterQuery } from 'mongoose'
import { ENTITY_STATUSES, type EntityStatus } from '../../constants/roles.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import type { IBranch, IBranchAddress } from '../../interfaces/branch.interface.js'
import { Branch } from '../../models/branch.model.js'
import { escapeRegex, omitUndefined, toObjectId, toObjectIds } from '../object-id.js'

export type BranchRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  name: string
  code: string
  address?: IBranchAddress
  timezone: string
  status: EntityStatus
  createdAt: Date
  updatedAt: Date
}

type PersistableBranch = {
  _id: { toString(): string }
  organizationId: { toString(): string }
  legalEntityId: { toString(): string }
  name: string
  code: string
  address?: IBranchAddress | null
  timezone: string
  status: string
  createdAt: Date
  updatedAt: Date
}

function toAddress(address: IBranchAddress | null | undefined): IBranchAddress | undefined {
  if (!address) return undefined
  const { line1, line2, city, region, postalCode, country } = address
  return { line1, line2, city, region, postalCode, country }
}

function toRecord(doc: PersistableBranch): BranchRecord {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    legalEntityId: doc.legalEntityId.toString(),
    name: doc.name,
    code: doc.code,
    address: toAddress(doc.address),
    timezone: doc.timezone,
    status: doc.status === ENTITY_STATUSES.ACTIVE ? ENTITY_STATUSES.ACTIVE : ENTITY_STATUSES.INACTIVE,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export async function findBranchById(id: string): Promise<BranchRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Branch.findById(objectId).lean()
  return doc ? toRecord(doc) : null
}

export async function findBranchesByIds(ids: readonly string[]): Promise<BranchRecord[]> {
  const objectIds = toObjectIds(ids)
  if (objectIds.length === 0) return []
  const docs = await Branch.find({ _id: { $in: objectIds } }).sort({ name: 1 }).lean()
  return docs.map(toRecord)
}

export async function findBranchesByOrganization(organizationId: string): Promise<BranchRecord[]> {
  const orgId = toObjectId(organizationId)
  if (!orgId) return []
  const docs = await Branch.find({ organizationId: orgId }).sort({ name: 1 }).lean()
  return docs.map(toRecord)
}

/** Counts how many of the given ids exist inside the organization (cross-tenant ids do not count). */
export async function countBranchesInOrganization(
  organizationId: string,
  branchIds: readonly string[],
): Promise<number> {
  const orgId = toObjectId(organizationId)
  const unique = toObjectIds(branchIds)
  if (!orgId || unique.length === 0) return 0
  return Branch.countDocuments({ organizationId: orgId, _id: { $in: unique } })
}

export async function listBranches(input: {
  organizationId: string
  skip: number
  take: number
  search?: string
  status?: EntityStatus
  legalEntityId?: string
  /** When set, only these branches are visible (branch-limited users). */
  onlyIds?: string[]
}): Promise<{ items: BranchRecord[]; total: number }> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }

  const filter: FilterQuery<IBranch> = { organizationId }
  if (input.status) filter.status = input.status
  if (input.legalEntityId) {
    const legalEntityId = toObjectId(input.legalEntityId)
    if (!legalEntityId) return { items: [], total: 0 }
    filter.legalEntityId = legalEntityId
  }
  if (input.onlyIds) filter._id = { $in: toObjectIds(input.onlyIds) }
  if (input.search) {
    filter.$or = [
      { name: { $regex: escapeRegex(input.search), $options: 'i' } },
      { code: { $regex: escapeRegex(input.search.toUpperCase()) } },
    ]
  }

  try {
    const [items, total] = await Promise.all([
      Branch.find(filter).sort({ name: 1 }).skip(input.skip).limit(input.take).lean(),
      Branch.countDocuments(filter),
    ])
    return { items: items.map(toRecord), total }
  } catch (error) {
    rethrowDatabaseError(error, 'Branches could not be loaded.')
  }
}

export async function createBranch(input: {
  organizationId: string
  legalEntityId: string
  name: string
  code: string
  address?: IBranchAddress
  timezone: string
  status: EntityStatus
}): Promise<BranchRecord> {
  try {
    const doc = await Branch.create({
      ...input,
      organizationId: toObjectId(input.organizationId),
      legalEntityId: toObjectId(input.legalEntityId),
    })
    return toRecord(doc)
  } catch (error) {
    rethrowDatabaseError(error, 'A branch with this code already exists in the organization.')
  }
}

export async function updateBranch(
  id: string,
  organizationId: string,
  input: Partial<{
    legalEntityId: string
    name: string
    address: IBranchAddress
    timezone: string
    status: EntityStatus
  }>,
): Promise<BranchRecord | null> {
  const objectId = toObjectId(id)
  const orgId = toObjectId(organizationId)
  if (!objectId || !orgId) return null

  const { legalEntityId, ...rest } = input
  const $set: Record<string, unknown> = omitUndefined(rest)
  if (legalEntityId !== undefined) $set.legalEntityId = toObjectId(legalEntityId)

  try {
    // Scoped by organizationId so a record can never be updated through another tenant.
    const doc = await Branch.findOneAndUpdate(
      { _id: objectId, organizationId: orgId },
      { $set },
      { new: true, runValidators: true },
    ).lean()
    return doc ? toRecord(doc) : null
  } catch (error) {
    rethrowDatabaseError(error, 'The branch could not be updated.')
  }
}
