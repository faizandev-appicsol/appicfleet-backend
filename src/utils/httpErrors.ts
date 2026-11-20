import { ENTITY_STATUSES, type EntityStatus } from '../constants/roles.js'
import { AppError } from '../exceptions/AppError.js'
import { ERROR_CODES } from '../exceptions/errorCodes.js'

export function notFound(message: string): AppError {
  return new AppError(message, 404, ERROR_CODES.NOT_FOUND)
}

export function forbiddenError(message: string): AppError {
  return new AppError(message, 403, ERROR_CODES.FORBIDDEN)
}

export function conflict(message: string): AppError {
  return new AppError(message, 409, ERROR_CODES.CONFLICT)
}

export function invalidField(field: string, message: string): AppError {
  return new AppError('Some fields need to be corrected.', 422, ERROR_CODES.VALIDATION_ERROR, {
    fieldErrors: { [field]: [message] },
  })
}

export function toEntityStatus(value: 'active' | 'inactive'): EntityStatus {
  return value === 'active' ? ENTITY_STATUSES.ACTIVE : ENTITY_STATUSES.INACTIVE
}

export function toPublicEntityStatus(value: EntityStatus): 'active' | 'inactive' {
  return value === ENTITY_STATUSES.ACTIVE ? 'active' : 'inactive'
}
