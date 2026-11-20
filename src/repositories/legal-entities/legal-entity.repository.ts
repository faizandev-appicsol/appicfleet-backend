import type { FilterQuery, UpdateQuery } from 'mongoose'
import { ENTITY_STATUSES, type EntityStatus } from '../../constants/roles.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import type { ILegalEntity } from '../../interfaces/legal-entity.interface.js'
import { LegalEntity } from '../../models/legal-entity.model.js'
import { escapeRegex, omitUndefined, toObjectId, toObjectIds } from '../object-id.js'

export type LegalEntityRecord = {
  id: string
  organizationId: string
  legalName: string
  displayName: string
  status: EntityStatus
  country: string
  taxIdentifier?: string
  defaultCurrency: string
  timezone: string
  createdAt: Date
  updatedAt: Date
}

type PersistableLegalEntity = {
  _id: { toString(): string }
  organizationId: { toString(): string }
  legalName: string
  displayName: string
  status: string
  country: string
  taxIdentifier?: string | null
  defaultCurrency: string
  timezone: string
  createdAt: Date
  updatedAt: Date
}

function toRecord(doc: PersistableLegalEntity): LegalEntityRecord {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    legalName: doc.legalName,
    displayName: doc.displayName,
    status: doc.status === ENTITY_STATUSES.ACTIVE ? ENTITY_STATUSES.ACTIVE : ENTITY_STATUSES.INACTIVE,
    country: doc.country,
    taxIdentifier: doc.taxIdentifier ?? undefined,
    defaultCurrency: doc.defaultCurrency,
    timezone: doc.timezone,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export async function findLegalEntityById(id: string): Promise<LegalEntityRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await LegalEntity.findById(objectId).lean()
  return doc ? toRecord(doc) : null
}

/** Counts how many of the given ids exist inside the organization (cross-tenant ids do not count). */
export async function countLegalEntitiesInOrganization(
  organizationId: string,
  legalEntityIds: readonly string[],
): Promise<number> {
  const orgId = toObjectId(organizationId)
  const unique = toObjectIds(legalEntityIds)
  if (!orgId || unique.length === 0) return 0
  return LegalEntity.countDocuments({ organizationId: orgId, _id: { $in: unique } })
}

export async function listLegalEntities(input: {
  organizationId: string
  skip: number
  take: number
  search?: string
  status?: EntityStatus
  /** When set, only these legal entities are visible. */
  onlyIds?: string[]
}): Promise<{ items: LegalEntityRecord[]; total: number }> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }

  const filter: FilterQuery<ILegalEntity> = { organizationId }
  if (input.status) filter.status = input.status
  if (input.onlyIds) filter._id = { $in: toObjectIds(input.onlyIds) }
  if (input.search) {
    filter.$or = [
      { legalName: { $regex: escapeRegex(input.search), $options: 'i' } },
      { displayName: { $regex: escapeRegex(input.search), $options: 'i' } },
    ]
  }

  try {
    const [items, total] = await Promise.all([
      LegalEntity.find(filter).sort({ legalName: 1 }).skip(input.skip).limit(input.take).lean(),
      LegalEntity.countDocuments(filter),
    ])
    return { items: items.map(toRecord), total }
  } catch (error) {
    rethrowDatabaseError(error, 'Legal entities could not be loaded.')
  }
}

export async function createLegalEntity(input: {
  organizationId: string
  legalName: string
  displayName: string
  status: EntityStatus
  country: string
  taxIdentifier?: string
  defaultCurrency: string
  timezone: string
}): Promise<LegalEntityRecord> {
  try {
    const doc = await LegalEntity.create({
      ...input,
      organizationId: toObjectId(input.organizationId),
    })
    return toRecord(doc)
  } catch (error) {
    rethrowDatabaseError(error, 'This legal entity already exists.')
  }
}

export async function updateLegalEntity(
  id: string,
  organizationId: string,
  input: Partial<{
    legalName: string
    displayName: string
    status: EntityStatus
    country: string
    taxIdentifier: string | null
    defaultCurrency: string
    timezone: string
  }>,
): Promise<LegalEntityRecord | null> {
  const objectId = toObjectId(id)
  const orgId = toObjectId(organizationId)
  if (!objectId || !orgId) return null

  const { taxIdentifier, ...rest } = input
  const $set: Record<string, unknown> = omitUndefined(rest)
  const update: UpdateQuery<ILegalEntity> = { $set }
  if (taxIdentifier === null) update.$unset = { taxIdentifier: 1 }
  else if (taxIdentifier !== undefined) $set.taxIdentifier = taxIdentifier

  try {
    // Scoped by organizationId so a record can never be updated through another tenant.
    const doc = await LegalEntity.findOneAndUpdate({ _id: objectId, organizationId: orgId }, update, {
      new: true,
      runValidators: true,
    }).lean()
    return doc ? toRecord(doc) : null
  } catch (error) {
    rethrowDatabaseError(error, 'The legal entity could not be updated.')
  }
}
