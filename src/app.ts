import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import { appConfig } from './config/app.config.js'
import { CUSTOMER_UPLOAD_BODY_LIMIT } from './constants/customers.js'
import { corsOptions } from './config/cors.js'
import { env } from './config/env.js'
import { errorMiddleware } from './middlewares/error.middleware.js'
import { notFoundMiddleware } from './middlewares/notFound.middleware.js'
import { apiRateLimiter } from './middlewares/rateLimit.middleware.js'
import { requestContext } from './middlewares/requestContext.middleware.js'
import { requestLogger } from './middlewares/requestLogger.middleware.js'
import { apiRouter } from './routes/index.js'

/** Routes that carry a base64 file and need the raised JSON body limit. */
export function isLargeJsonUpload(method: string, path: string): boolean {
  if (method !== 'POST') return false
  if (path.includes('/customers/') && path.endsWith('/documents')) return true
  if (path.includes('/vehicles/') && path.endsWith('/photo')) return true
  return false
}

/** @deprecated Prefer `isLargeJsonUpload`. */
export function isCustomerDocumentUpload(method: string, path: string): boolean {
  return isLargeJsonUpload(method, path)
}

export function createApp(): Express {
  const app = express()

  app.disable('x-powered-by')
  if (env.isProduction || env.isStaging) app.set('trust proxy', 1)

  app.use(helmet())
  app.use(cors(corsOptions))
  // The default JSON limit applies everywhere except the customer document upload, whose body
  // carries a base64 file (5 MB decoded is about 6.7 MB of text).
  const defaultJson = express.json({ limit: appConfig.bodyLimit })
  const customerUploadJson = express.json({ limit: CUSTOMER_UPLOAD_BODY_LIMIT })
  app.use((req, res, next) =>
    (isLargeJsonUpload(req.method, req.path) ? customerUploadJson : defaultJson)(req, res, next),
  )
  app.use(express.urlencoded({ extended: false, limit: appConfig.bodyLimit }))
  app.use(cookieParser())
  app.use(requestContext)
  app.use(requestLogger)
  app.use(apiRateLimiter)
  app.use(apiRouter)
  app.use(notFoundMiddleware)
  app.use(errorMiddleware)

  return app
}

export const app = createApp()
