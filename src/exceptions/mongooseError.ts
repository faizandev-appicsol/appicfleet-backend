import mongoose from 'mongoose'
import { AppError } from './AppError.js'
import { ERROR_CODES } from './errorCodes.js'

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : ''
}

export function toDatabaseAppError(error: unknown, conflictMessage: string): AppError | null {
  if (error instanceof mongoose.Error.CastError) {
    return new AppError('The identifier is invalid.', 400, ERROR_CODES.VALIDATION_ERROR, {
      cause: error,
    })
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return new AppError('The record could not be saved.', 422, ERROR_CODES.VALIDATION_ERROR, {
      cause: error,
    })
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  ) {
    return new AppError(conflictMessage, 409, ERROR_CODES.CONFLICT, { cause: error })
  }

  const name = errorName(error)
  if (
    name === 'MongoServerSelectionError' ||
    name === 'MongooseServerSelectionError' ||
    name === 'MongoNetworkError' ||
    name === 'MongoServerError'
  ) {
    if (name === 'MongoServerError') return null
    return new AppError('The database is unavailable.', 503, ERROR_CODES.DATABASE_UNAVAILABLE, {
      cause: error,
    })
  }

  return null
}

export function rethrowDatabaseError(error: unknown, conflictMessage: string): never {
  const mapped = toDatabaseAppError(error, conflictMessage)
  if (mapped) throw mapped
  throw error
}
