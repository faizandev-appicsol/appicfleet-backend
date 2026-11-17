import type { ErrorCode } from './errorCodes.js'

type AppErrorOptions = {
  details?: unknown
  fieldErrors?: Record<string, string[]>
  cause?: unknown
}

export class AppError extends Error {
  readonly statusCode: number
  readonly code: ErrorCode
  readonly details?: unknown
  readonly fieldErrors?: Record<string, string[]>
  readonly isOperational = true

  constructor(message: string, statusCode: number, code: ErrorCode, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = options.details
    this.fieldErrors = options.fieldErrors
  }
}
