import { randomBytes } from 'node:crypto'
import {
  ROLES,
  toPublicRole,
  toPublicStatus,
  toRole,
  toStatus,
  USER_STATUSES,
  type Role,
} from '../../constants/roles.js'
import { AppError } from '../../exceptions/AppError.js'
import { ERROR_CODES } from '../../exceptions/errorCodes.js'
import { hashPassword } from '../../lib/password/index.js'
import { revokeAllRefreshTokens } from '../../repositories/auth/refresh-token.repository.js'
import {
  createUser,
  deleteUser,
  findUserById,
  listUsers,
  updateUser,
} from '../../repositories/users/user.repository.js'
import type { AuthenticatedUser } from '../../types/auth.js'
import type { UserRecord, UserResource } from '../../types/user.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  CreateUserBody,
  ListUsersQuery,
  UpdateUserBody,
} from '../../validations/user.validation.js'

function toResource(user: UserRecord): UserResource {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: toPublicRole(user.role),
    status: toPublicStatus(user.status),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

function requireRole(value: string): Role {
  const role = toRole(value)
  if (!role) {
    throw new AppError('Role is not supported.', 422, ERROR_CODES.VALIDATION_ERROR)
  }
  return role
}

function assertCanManage(actor: AuthenticatedUser, role: Role): void {
  if (actor.role === ROLES.ADMIN) return
  if (actor.role === ROLES.MANAGER && role !== ROLES.ADMIN) return
  throw new AppError(
    'You do not have permission to manage this account.',
    403,
    ERROR_CODES.FORBIDDEN,
  )
}

export async function listUserDirectory(query: ListUsersQuery) {
  const pagination = resolvePagination({
    page: query.page,
    limit: query.limit,
    pageSize: query.pageSize,
  })
  const search = query.search?.trim() ? query.search.trim() : undefined
  const result = await listUsers({
    skip: pagination.skip,
    take: pagination.take,
    search,
    sort: query.sort ?? 'createdAt',
    order: query.order ?? 'desc',
  })

  return toPaginated(result.items.map(toResource), pagination.page, pagination.limit, result.total)
}

export async function getUser(id: string): Promise<UserResource> {
  const user = await findUserById(id)
  if (!user) {
    throw new AppError('User was not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  return toResource(user)
}

export async function inviteUser(
  actor: AuthenticatedUser,
  input: CreateUserBody,
): Promise<UserResource> {
  const role = requireRole(input.role)
  assertCanManage(actor, role)

  const user = await createUser({
    email: input.email.toLowerCase(),
    name: input.name.trim(),
    role,
    status: USER_STATUSES.INVITED,
    passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
  })
  return toResource(user)
}

export async function changeUser(
  actor: AuthenticatedUser,
  id: string,
  input: UpdateUserBody,
): Promise<UserResource> {
  const existing = await findUserById(id)
  if (!existing) {
    throw new AppError('User was not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const role = requireRole(input.role)
  const status = toStatus(input.status)
  if (!status) {
    throw new AppError('Status is not supported.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  assertCanManage(actor, existing.role)
  assertCanManage(actor, role)

  const user = await updateUser(id, {
    email: input.email.toLowerCase(),
    name: input.name.trim(),
    role,
    status,
  })
  return toResource(user)
}

export async function removeUser(actor: AuthenticatedUser, id: string): Promise<void> {
  if (actor.id === id) {
    throw new AppError('You cannot delete your own account.', 403, ERROR_CODES.FORBIDDEN)
  }

  const existing = await findUserById(id)
  if (!existing) {
    throw new AppError('User was not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  assertCanManage(actor, existing.role)
  await revokeAllRefreshTokens(id)
  await deleteUser(id)
}
