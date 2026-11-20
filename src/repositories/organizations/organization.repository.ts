import type { FilterQuery } from 'mongoose'
import { ENTITY_STATUSES, type EntityStatus } from '../../constants/roles.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import type { IOrganization } from '../../interfaces/organization.interface.js'
import { Organization } from '../../models/organization.model.js'
import { escapeRegex, omitUndefined, toObjectId } from '../object-id.js'

export type OrganizationRecord = {
  id: string
  name: string
  code: string
  status: EntityStatus
  createdAt: Date
  updatedAt: Date
}

type PersistableOrganization = {
  _id: { toString(): string }
  name: string
  code: string
  status: string
  createdAt: Date
  updatedAt: Date
}

function toRecord(doc: PersistableOrganization): OrganizationRecord {
  return {
    id: doc._id.toString(),
    name: doc.name,
    code: doc.code,
    status: doc.status === ENTITY_STATUSES.ACTIVE ? ENTITY_STATUSES.ACTIVE : ENTITY_STATUSES.INACTIVE,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export async function findOrganizationById(id: string): Promise<OrganizationRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Organization.findById(objectId).lean()
  return doc ? toRecord(doc) : null
}

export async function listOrganizations(input: {
  skip: number
  take: number
  search?: string
  status?: EntityStatus
  /** When set, only these organizations are visible (tenant scope). */
  onlyIds?: string[]
}): Promise<{ items: OrganizationRecord[]; total: number }> {
  const filter: FilterQuery<IOrganization> = {}
  if (input.status) filter.status = input.status
  if (input.onlyIds) {
    filter._id = { $in: input.onlyIds.map(toObjectId).filter((id) => id !== null) }
  }
  if (input.search) {
    filter.$or = [
      { name: { $regex: escapeRegex(input.search), $options: 'i' } },
      { code: { $regex: escapeRegex(input.search.toUpperCase()) } },
    ]
  }

  try {
    const [items, total] = await Promise.all([
      Organization.find(filter).sort({ name: 1 }).skip(input.skip).limit(input.take).lean(),
      Organization.countDocuments(filter),
    ])
    return { items: items.map(toRecord), total }
  } catch (error) {
    rethrowDatabaseError(error, 'Organizations could not be loaded.')
  }
}

export async function createOrganization(input: {
  name: string
  code: string
  status: EntityStatus
}): Promise<OrganizationRecord> {
  try {
    const doc = await Organization.create(input)
    return toRecord(doc)
  } catch (error) {
    rethrowDatabaseError(error, 'An organization with this code already exists.')
  }
}

export async function updateOrganization(
  id: string,
  input: { name?: string; status?: EntityStatus },
): Promise<OrganizationRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  try {
    const doc = await Organization.findByIdAndUpdate(
      objectId,
      { $set: omitUndefined(input) },
      { new: true, runValidators: true },
    ).lean()
    return doc ? toRecord(doc) : null
  } catch (error) {
    rethrowDatabaseError(error, 'The organization could not be updated.')
  }
}
