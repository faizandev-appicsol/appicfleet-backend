import { rateLimit } from 'express-rate-limit'
import { appConfig } from '../config/app.config.js'
import { ERROR_CODES } from '../exceptions/errorCodes.js'

function rateLimitBody(message: string) {
  return {
    success: false as const,
    message,
    error: { code: ERROR_CODES.RATE_LIMITED },
  }
}

export const apiRateLimiter = rateLimit({
  windowMs: appConfig.apiRateLimit.windowMs,
  limit: appConfig.apiRateLimit.limit,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === `${appConfig.apiPrefix}/health`,
  message: rateLimitBody('Too many requests. Wait a moment and try again.'),
})

export const authRateLimiter = rateLimit({
  windowMs: appConfig.authRateLimit.windowMs,
  limit: appConfig.authRateLimit.limit,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody('Too many authentication attempts. Wait a moment and try again.'),
})
