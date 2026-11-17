import type { ErrorRequestHandler } from 'express'
import { env } from '../config/env.js'
import { AppError } from '../exceptions/AppError.js'
import { ERROR_CODES } from '../exceptions/errorCodes.js'
import { toDatabaseAppError } from '../exceptions/mongooseError.js'
import { logger } from '../lib/logger/index.js'

function isJsonSyntaxError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    'status' in error &&
    (error as { status?: unknown }).status === 400 &&
    'body' in error
  )
}

function normalize(error: unknown): AppError {
  if (error instanceof AppError) return error

  const databaseError = toDatabaseAppError(error, 'A record with this value already exists.')
  if (databaseError) return databaseError

  if (isJsonSyntaxError(error)) {
    return new AppError('Request body must be valid JSON.', 400, ERROR_CODES.INVALID_JSON, {
      cause: error,
    })
  }

  return new AppError('Something went wrong.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
}

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  const normalized = normalize(error)
  const unexpected = normalized.code === ERROR_CODES.INTERNAL_ERROR && !(error instanceof AppError)

  if (unexpected) {
    logger.error('Unhandled error', {
      name: error instanceof Error ? error.name : 'Error',
      ...(env.isProduction || !(error instanceof Error) ? {} : { stack: error.stack }),
    })
  } else if (normalized.statusCode >= 500) {
    logger.error(normalized.message, { code: normalized.code })
  } else if (normalized.statusCode >= 400) {
    logger.warn(normalized.message, { code: normalized.code })
  }

  if (res.headersSent) return

  const body: {
    success: false
    message: string
    error: { code: string; details?: unknown }
    errors?: Record<string, string[]>
  } = {
    success: false,
    message: unexpected && env.isProduction ? 'Something went wrong.' : normalized.message,
    error: {
      code: normalized.code,
    },
  }

  if (!env.isProduction && normalized.details !== undefined) {
    body.error.details = normalized.details
  }

  if (normalized.fieldErrors) {
    body.errors = normalized.fieldErrors
  }

  res.status(normalized.statusCode).json(body)
}
