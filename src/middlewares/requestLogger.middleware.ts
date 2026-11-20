import type { RequestHandler } from 'express'
import { logger } from '../lib/logger/index.js'

export const requestLogger: RequestHandler = (req, res, next) => {
  const started = Date.now()

  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0] ?? req.path
    const meta = {
      module: 'http',
      operation: 'request',
      requestId: req.requestId,
      correlationId: req.correlationId,
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: Date.now() - started,
    }

    if (res.statusCode >= 500) {
      logger.error('request', meta)
      return
    }
    if (res.statusCode >= 400) {
      logger.warn('request', meta)
      return
    }
    logger.info('request', meta)
  })

  next()
}
