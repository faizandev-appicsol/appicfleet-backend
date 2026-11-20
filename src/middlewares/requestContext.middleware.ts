import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

const REQUEST_ID_HEADER = 'x-request-id'
const CORRELATION_ID_HEADER = 'x-correlation-id'

function readHeader(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const first = value[0]?.trim()
    return first || undefined
  }
  return undefined
}

/**
 * Attaches requestId and correlationId to every request for structured logs and responses.
 */
export const requestContext: RequestHandler = (req, res, next) => {
  const requestId = readHeader(req.headers[REQUEST_ID_HEADER]) ?? randomUUID()
  const correlationId = readHeader(req.headers[CORRELATION_ID_HEADER]) ?? requestId

  req.requestId = requestId
  req.correlationId = correlationId

  res.setHeader(REQUEST_ID_HEADER, requestId)
  res.setHeader(CORRELATION_ID_HEADER, correlationId)

  next()
}
