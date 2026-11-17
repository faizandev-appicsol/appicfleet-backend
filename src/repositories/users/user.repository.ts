import { Types, type FilterQuery } from 'mongoose'
import { isRole, isUserStatus, type Role, type UserStatus } from '../../constants/roles.js'
import { AppError } from '../../exceptions/AppError.js'
import { ERROR_CODES } from '../../exceptions/errorCodes.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import type { IUser } from '../../interfaces/user.interface.js'
import { User } from '../../models/user.model.js'
import type { UserCredentials, UserRecord } from '../../types/user.js'

type PersistableUser = {
  _id: { toString(): string }
  email: string
  name: string
  role: string
  status: string
  createdAt: Date
  updatedAt: Date
  passwordHash?: string
}

function toRecord(user: PersistableUser): UserRecord {
  if (!isRole(user.role) || !isUserStatus(user.status)) {
    throw new AppError('Stored account data is invalid.', 500, ERROR_CODES.INTERNAL_ERROR)
  }

  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function searchFilter(search?: string): FilterQuery<IUser> {
  if (!search) return {}
  return {
    $or: [
      { name: { $regex: escapeRegex(search), $options: 'i' } },
      { email: { $regex: escapeRegex(search.toLowerCase()) } },
    ],
  }
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (!Types.ObjectId.isValid(id)) return null
  const user = await User.findById(id).lean()
  return user ? toRecord(user) : null
}

export async function findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
  const user = await User.findOne({ email }).select('+passwordHash').lean()
  if (!user?.passwordHash) return null
  return { ...toRecord(user), passwordHash: user.passwordHash }
}

export async function createUser(input: {
  email: string
  name: string
  passwordHash: string
  role: Role
  status: UserStatus
}): Promise<UserRecord> {
  try {
    const user = await User.create(input)
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
}): Promise<{ items: UserRecord[]; total: number }> {
  const filter = searchFilter(input.search)
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

export async function updateUser(
  id: string,
  input: { email: string; name: string; role: Role; status: UserStatus },
): Promise<UserRecord> {
  try {
    const user = await User.findByIdAndUpdate(id, input, {
      new: true,
      runValidators: true,
    }).lean()
    if (!user) {
      throw new AppError('User was not found.', 404, ERROR_CODES.NOT_FOUND)
    }
    return toRecord(user)
  } catch (error) {
    if (error instanceof AppError) throw error
    rethrowDatabaseError(error, 'An account with this email already exists.')
  }
}

export async function deleteUser(id: string): Promise<void> {
  try {
    const result = await User.deleteOne({ _id: id })
    if (result.deletedCount !== 1) {
      throw new AppError('User was not found.', 404, ERROR_CODES.NOT_FOUND)
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    rethrowDatabaseError(error, 'The user could not be deleted.')
  }
}
