import type { FilterQuery } from 'mongoose'
import { ENTITY_STATUSES, type EntityStatus } from '../../constants/roles.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import type { IRole } from '../../interfaces/role.interface.js'
import { Role } from '../../models/role.model.js'
import { toObjectId, toObjectIds } from '../object-id.js'

export type RoleRecord = {
  id: string
  /** null = system role. */
  organizationId: string | null
  code: string
  name: string
  description?: string
  permissionKeys: string[]
  isSystem: boolean
  status: EntityStatus
  createdAt: Date
  updatedAt: Date
}

type PersistableRole = {
  _id: { toString(): string }
  organizationId?: { toString(): string } | null
  code: string
  name: string
  description?: string | null
  permissionKeys?: string[] | null
  isSystem: boolean
  status: string
  createdAt: Date
  updatedAt: Date
}

function toRecord(doc: PersistableRole): RoleRecord {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId ? doc.organizationId.toString() : null,
    code: doc.code,
    name: doc.name,
    description: doc.description ?? undefined,
    permissionKeys: [...(doc.permissionKeys ?? [])],
    isSystem: doc.isSystem,
    status: doc.status === ENTITY_STATUSES.ACTIVE ? ENTITY_STATUSES.ACTIVE : ENTITY_STATUSES.INACTIVE,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export async function findRoleById(id: string): Promise<RoleRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Role.findById(objectId).lean()
  return doc ? toRecord(doc) : null
}

export async function findRolesByIds(ids: readonly string[]): Promise<RoleRecord[]> {
  const objectIds = toObjectIds(ids)
  if (objectIds.length === 0) return []
  const docs = await Role.find({ _id: { $in: objectIds } }).lean()
  return docs.map(toRecord)
}

/**
 * Lists roles visible to an organization: system roles plus that organization's custom roles.
 * Pass `organizationId: null` for system roles only, or `all: true` for every role (platform-wide).
 */
export async function listRoles(input: {
  organizationId: string | null
  all?: boolean
  excludeCodes?: readonly string[]
}): Promise<RoleRecord[]> {
  const filter: FilterQuery<IRole> = {}
  if (!input.all) {
    const orgId = input.organizationId ? toObjectId(input.organizationId) : null
    filter.$or = orgId ? [{ organizationId: null }, { organizationId: orgId }] : [{ organizationId: null }]
  }
  if (input.excludeCodes && input.excludeCodes.length > 0) {
    filter.code = { $nin: [...input.excludeCodes] }
  }

  const docs = await Role.find(filter).sort({ isSystem: -1, name: 1 }).lean()
  return docs.map(toRecord)
}

export async function createRole(input: {
  organizationId: string
  code: string
  name: string
  description?: string
  permissionKeys: string[]
}): Promise<RoleRecord> {
  try {
    const doc = await Role.create({
      organizationId: toObjectId(input.organizationId),
      code: input.code,
      name: input.name,
      description: input.description,
      permissionKeys: input.permissionKeys,
      isSystem: false,
      status: ENTITY_STATUSES.ACTIVE,
    })
    return toRecord(doc)
  } catch (error) {
    rethrowDatabaseError(error, 'A role with this code already exists in the organization.')
  }
}

/** Only custom roles are writable here; system roles are filtered out by `isSystem: false`. */
export async function updateCustomRolePermissions(
  id: string,
  permissionKeys: string[],
): Promise<RoleRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  try {
    const doc = await Role.findOneAndUpdate(
      { _id: objectId, isSystem: false },
      { $set: { permissionKeys } },
      { new: true, runValidators: true },
    ).lean()
    return doc ? toRecord(doc) : null
  } catch (error) {
    rethrowDatabaseError(error, 'The role could not be updated.')
  }
}
