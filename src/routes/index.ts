import { Router } from 'express'
import { appConfig } from '../config/app.config.js'
import { authRouter } from './auth.routes.js'
import { docsRouter } from './docs.routes.js'
import { healthRouter } from './health.routes.js'
import { userRouter } from './user.routes.js'

export const apiRouter = Router()

const v1 = Router()
v1.use('/health', healthRouter)
v1.use('/auth', authRouter)
v1.use('/users', userRouter)
v1.use(docsRouter)

apiRouter.use(appConfig.apiPrefix, v1)
