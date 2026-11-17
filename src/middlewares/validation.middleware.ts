import type { Request, RequestHandler } from 'express'
import { ZodError, type ZodType } from 'zod'
import { AppError } from '../exceptions/AppError.js'
import { ERROR_CODES } from '../exceptions/errorCodes.js'
import type { ValidatedRequestData } from '../types/http.js'
import { fieldErrorsFromZod } from '../utils/fieldErrors.js'

type RequestSchema = {
  body?: ZodType
  query?: ZodType
  params?: ZodType
  headers?: ZodType
}

function firstValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value
}

function flattenRecord(record: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    flat[key] = firstValue(value)
  }
  return flat
}

export function validate(schema: RequestSchema): RequestHandler {
  return (req, _res, next) => {
    try {
      const validated: ValidatedRequestData = {
        body: schema.body?.parse(req.body),
        query: schema.query ? schema.query.parse(flattenRecord(req.query)) : undefined,
        params: schema.params ? schema.params.parse(flattenRecord(req.params)) : undefined,
        headers: schema.headers ? schema.headers.parse(flattenRecord(req.headers)) : undefined,
      }
      req.validated = validated
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new AppError('Some fields need to be corrected.', 422, ERROR_CODES.VALIDATION_ERROR, {
            fieldErrors: fieldErrorsFromZod(error),
          }),
        )
        return
      }
      next(error)
    }
  }
}

export function getValidated<T>(req: Request): T {
  if (!req.validated) {
    throw new AppError('Request validation did not run.', 500, ERROR_CODES.INTERNAL_ERROR)
  }
  return req.validated as T
}
