import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import { appConfig } from './config/app.config.js'
import { corsOptions } from './config/cors.js'
import { env } from './config/env.js'
import { errorMiddleware } from './middlewares/error.middleware.js'
import { notFoundMiddleware } from './middlewares/notFound.middleware.js'
import { apiRateLimiter } from './middlewares/rateLimit.middleware.js'
import { requestLogger } from './middlewares/requestLogger.middleware.js'
import { apiRouter } from './routes/index.js'

export function createApp(): Express {
  const app = express()

  app.disable('x-powered-by')
  if (env.isProduction) app.set('trust proxy', 1)

  app.use(helmet())
  app.use(cors(corsOptions))
  app.use(express.json({ limit: appConfig.bodyLimit }))
  app.use(express.urlencoded({ extended: false, limit: appConfig.bodyLimit }))
  app.use(cookieParser())
  app.use(requestLogger)
  app.use(apiRateLimiter)
  app.use(apiRouter)
  app.use(notFoundMiddleware)
  app.use(errorMiddleware)

  return app
}

export const app = createApp()
