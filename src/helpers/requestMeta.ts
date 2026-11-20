import type { Request } from 'express'
import type { RequestMeta } from '../types/access.js'

/** Extracts audit-relevant request metadata so services never touch Express objects. */
export function getRequestMeta(req: Request): RequestMeta {
  const userAgent = req.header('user-agent')
  return {
    requestId: req.requestId,
    correlationId: req.correlationId,
    ip: req.ip,
    userAgent: userAgent ? userAgent.slice(0, 256) : undefined,
  }
}
