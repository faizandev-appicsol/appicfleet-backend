import { Router } from 'express'
import { appConfig } from '../config/app.config.js'
import { checkDatabase } from '../config/database.js'
import { env } from '../config/env.js'
import { sendSuccess } from '../helpers/response.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getMigrationStatus } from '../database/migrations/runner.js'

export const healthRouter = Router()

/** Liveness: process is up. Does not require database. */
healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, 'API is running.', {
      status: 'ok',
      service: appConfig.service,
      environment: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
    })
  }),
)

/** Readiness: required infrastructure is reachable. */
healthRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const database = await checkDatabase()
    let pendingMigrations = 0

    if (database === 'up') {
      try {
        const status = await getMigrationStatus()
        pendingMigrations = status.pending.length
      } catch {
        pendingMigrations = -1
      }
    }

    const ready = database === 'up' && pendingMigrations === 0
    const payload = {
      status: ready ? 'ready' : 'not_ready',
      service: appConfig.service,
      environment: env.nodeEnv,
      database,
      pendingMigrations,
    }

    if (!ready) {
      res.status(503).json({
        success: false,
        message: 'API is not ready.',
        data: payload,
      })
      return
    }

    sendSuccess(res, 'API is ready.', payload)
  }),
)
