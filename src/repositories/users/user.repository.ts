import type { FilterQuery, UpdateQuery } from 'mongoose'
import {
  isRole,
  isUserStatus,
  normalizeUserStatus,
  USER_STATUSES,
  type Role,
  type UserStatus,
} from '../../constants/roles.js'
import { AppError } from '../../exceptions/AppError.js'
import { ERROR_CODES } from '../../exceptions/errorCodes.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import type { IUser } from '../../interfaces/user.interface.js'
import { User } from '../../models/user.model.js'
import type { UserCredentials, UserRecord } from '../../types/user.js'
import { escapeRegex, toObjectId, toObjectIds } from '../object-id.js'

type IdLike = { toString(): string }

type PersistableUser = {
  _id: IdLike
  email: string
  name: string
  phone?: string | null
  organizationId?: IdLike | null
  role: string
  roleIds?: IdLike[] | null
  status: string
  legalEntityIds?: IdLike[] | null
  branchIds?: IdLike[] | null
  accessAllBranches?: boolean | null
  accessAllOrganizations?: boolean | null
  lastLoginAt?: Date | null
  failedLoginAttempts?: number | null
  lockedUntil?: Date | null
  createdAt: Date
  updatedAt: Date
  passwordHash?: string
}

function ids(values: IdLike[] | null | undefined): string[] {
  return (values ?? []).map((value) => value.toString())
}

function toRecord(user: PersistableUser): UserRecord {
  if (!isRole(user.role) || !isUserStatus(user.status)) {
    throw new AppError('Stored account data is invalid.', 500, ERROR_CODES.INTERNAL_ERROR)
  }

  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    phone: user.phone ?? undefined,
    organizationId: user.organizationId ? user.organizationId.toString() : null,
    role: user.role,
    roleIds: ids(user.roleIds),
    // Legacy DISABLED documents are read as INACTIVE.
    status: normalizeUserStatus(user.status),
    legalEntityIds: ids(user.legalEntityIds),
    branchIds: ids(user.branchIds),
    accessAllBranches: user.accessAllBranches === true,
    accessAllOrganizations: user.accessAllOrganizations === true,
    lastLoginAt: user.lastLoginAt ?? null,
    failedLoginAttempts: user.failedLoginAttempts ?? 0,
    lockedUntil: user.lockedUntil ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export type UserListScope = {
  /** Restrict to one organization. Omit only for platform-wide actors. */
  organizationId?: string
  /** Restrict to users sharing at least one of these branches (plus includeUserId). */
  branchIds?: string[]
  includeUserId?: string
  status?: UserStatus
}

function buildFilter(scope: UserListScope, search?: string): FilterQuery<IUser> {
  const clauses: FilterQuery<IUser>[] = []

  if (scope.organizationId) {
    // An invalid id matches nothing instead of widening the query.
    const organizationId = toObjectId(scope.organizationId)
    clauses.push(organizationId ? { organizationId } : { _id: { $in: [] } })
  }

  if (scope.branchIds) {
    const branchIds = toObjectIds(scope.branchIds)
    const own = scope.includeUserId ? toObjectId(scope.includeUserId) : null
    clauses.push({
      $or: [{ branchIds: { $in: branchIds } }, ...(own ? [{ _id: own }] : [])],
    })
  }

  if (scope.status) {
    clauses.push(
      scope.status === USER_STATUSES.INACTIVE
        ? { status: { $in: [USER_STATUSES.INACTIVE, USER_STATUSES.DISABLED] } }
        : { status: scope.status },
    )
  }

  if (search) {
    clauses.push({
      $or: [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { email: { $regex: escapeRegex(search.toLowerCase()) } },
      ],
    })
  }

  return clauses.length === 0 ? {} : { $and: clauses }
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const user = await User.findById(objectId).lean()
  return user ? toRecord(user) : null
}

export async function findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
  const user = await User.findOne({ email }).select('+passwordHash').lean()
  if (!user?.passwordHash) return null
  return { ...toRecord(user), passwordHash: user.passwordHash }
}

export async function findCredentialsById(id: string): Promise<UserCredentials | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const user = await User.findById(objectId).select('+passwordHash').lean()
  if (!user?.passwordHash) return null
  return { ...toRecord(user), passwordHash: user.passwordHash }
}

export async function updatePasswordHash(id: string, passwordHash: string): Promise<void> {
  const objectId = toObjectId(id)
  if (!objectId) {
    throw new AppError('User was not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  try {
    const result = await User.updateOne({ _id: objectId }, { $set: { passwordHash } })
    if (result.matchedCount !== 1) {
      throw new AppError('User was not found.', 404, ERROR_CODES.NOT_FOUND)
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    rethrowDatabaseError(error, 'The password could not be updated.')
  }
}

export async function createUser(input: {
  email: string
  name: string
  phone?: string
  passwordHash: string
  organizationId: string | null
  role: Role
  status: UserStatus
  branchIds?: string[]
  legalEntityIds?: string[]
  accessAllBranches?: boolean
}): Promise<UserRecord> {
  try {
    const user = await User.create({
      email: input.email,
      name: input.name,
      phone: input.phone,
      passwordHash: input.passwordHash,
      organizationId: input.organizationId ? toObjectId(input.organizationId) : null,
      role: input.role,
      status: input.status,
      branchIds: toObjectIds(input.branchIds ?? []),
      legalEntityIds: toObjectIds(input.legalEntityIds ?? []),
      accessAllBranches: input.accessAllBranches ?? false,
    })
    return toRecord(user)
  } catch (error) {
    rethrowDatabaseError(error, 'An account with this email already exists.')
  }
}

export async function listUsers(input: {
  skip: number
  take: number
  search?: string
  sort: 'name' | 'email' | 'createdAt'
  order: 'asc' | 'desc'
  scope: UserListScope
}): Promise<{ items: UserRecord[]; total: number }> {
  const filter = buildFilter(input.scope, input.search)
  const direction = input.order === 'asc' ? 1 : -1

  try {
    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ [input.sort]: direction })
        .skip(input.skip)
        .limit(input.take)
        .lean(),
      User.countDocuments(filter),
    ])

    return { items: items.map(toRecord), total }
  } catch (error) {
    rethrowDatabaseError(error, 'The user directory could not be loaded.')
  }
}

async function applyUpdate(
  id: string,
  update: UpdateQuery<IUser>,
  conflictMessage = 'An account with this email already exists.',
): Promise<UserRecord> {
  const objectId = toObjectId(id)
  if (!objectId) throw new AppError('User was not found.', 404, ERROR_CODES.NOT_FOUND)

  try {
    const user = await User.findByIdAndUpdate(objectId, update, {
      new: true,
      runValidators: true,
    }).lean()
    if (!user) {
      throw new AppError('User was not found.', 404, ERROR_CODES.NOT_FOUND)
    }
    return toRecord(user)
  } catch (error) {
    if (error instanceof AppError) throw error
    rethrowDatabaseError(error, conflictMessage)
  }
}

export async function updateUser(
  id: string,
  input: {
    email?: string
    name?: string
    phone?: string | null
    role?: Role
    status?: UserStatus
  },
): Promise<UserRecord> {
  const $set: Record<string, unknown> = {}
  const $unset: Record<string, 1> = {}
  if (input.email !== undefined) $set.email = input.email
  if (input.name !== undefined) $set.name = input.name
  if (input.role !== undefined) $set.role = input.role
  if (input.status !== undefined) $set.status = input.status
  if (input.phone === null) $unset.phone = 1
  else if (input.phone !== undefined) $set.phone = input.phone

  return applyUpdate(id, {
    ...(Object.keys($set).length > 0 ? { $set } : {}),
    ...(Object.keys($unset).length > 0 ? { $unset } : {}),
  })
}

export async function updateUserStatus(id: string, status: UserStatus): Promise<UserRecord> {
  // Reactivation also clears any brute-force lock.
  return applyUpdate(id, {
    $set: { status, failedLoginAttempts: 0, lockedUntil: null },
  })
}

export async function updateUserAccess(
  id: string,
  input: { branchIds: string[]; legalEntityIds: string[]; accessAllBranches: boolean },
): Promise<UserRecord> {
  return applyUpdate(id, {
    $set: {
      branchIds: toObjectIds(input.branchIds),
      legalEntityIds: toObjectIds(input.legalEntityIds),
      accessAllBranches: input.accessAllBranches,
    },
  })
}

export async function updateUserRoles(
  id: string,
  input: { role?: Role; roleIds?: string[] },
): Promise<UserRecord> {
  const $set: Record<string, unknown> = {}
  if (input.role !== undefined) $set.role = input.role
  if (input.roleIds !== undefined) $set.roleIds = toObjectIds(input.roleIds)
  return applyUpdate(id, { $set })
}

export async function recordLoginSuccess(id: string): Promise<void> {
  const objectId = toObjectId(id)
  if (!objectId) return
  await User.updateOne(
    { _id: objectId },
    { $set: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null } },
  )
}

/**
 * Atomically counts a failed sign-in and locks the account once maxAttempts is reached.
 * An expired lock starts a fresh count first.
 */
export async function recordFailedLogin(
  id: string,
  options: { maxAttempts: number; lockMs: number },
): Promise<{ failedLoginAttempts: number; lockedUntil: Date | null }> {
  const objectId = toObjectId(id)
  if (!objectId) return { failedLoginAttempts: 0, lockedUntil: null }

  const now = new Date()
  await User.updateOne(
    { _id: objectId, lockedUntil: { $lte: now } },
    { $set: { failedLoginAttempts: 0, lockedUntil: null } },
  )

  const updated = await User.findByIdAndUpdate(
    objectId,
    { $inc: { failedLoginAttempts: 1 } },
    { new: true },
  ).lean()
  if (!updated) return { failedLoginAttempts: 0, lockedUntil: null }

  const attempts = updated.failedLoginAttempts ?? 1
  if (attempts >= options.maxAttempts) {
    const lockedUntil = new Date(now.getTime() + options.lockMs)
    await User.updateOne({ _id: objectId }, { $set: { lockedUntil } })
    return { failedLoginAttempts: attempts, lockedUntil }
  }
  return { failedLoginAttempts: attempts, lockedUntil: updated.lockedUntil ?? null }
}

export async function deleteUser(id: string): Promise<void> {
  const objectId = toObjectId(id)
  if (!objectId) throw new AppError('User was not found.', 404, ERROR_CODES.NOT_FOUND)

  try {
    const result = await User.deleteOne({ _id: objectId })
    if (result.deletedCount !== 1) {
      throw new AppError('User was not found.', 404, ERROR_CODES.NOT_FOUND)
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    rethrowDatabaseError(error, 'The user could not be deleted.')
  }
}
