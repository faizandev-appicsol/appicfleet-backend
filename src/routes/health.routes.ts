import { Router } from 'express'
import { appConfig } from '../config/app.config.js'
import { checkDatabase } from '../config/database.js'
import { sendSuccess } from '../helpers/response.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const healthRouter = Router()

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const database = await checkDatabase()
    sendSuccess(res, 'API is running.', {
      status: 'ok',
      service: appConfig.service,
      uptimeSeconds: Math.round(process.uptime()),
      database,
    })
  }),
)
