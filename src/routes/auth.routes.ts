import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware.js'
import { authRateLimiter } from '../middlewares/rateLimit.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import {
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
} from '../controllers/auth/auth.controller.js'
import { loginBodySchema, refreshBodySchema } from '../validations/auth.validation.js'

export const authRouter = Router()

authRouter.use(authRateLimiter)
authRouter.post('/login', validate({ body: loginBodySchema }), loginHandler)
authRouter.post('/logout', validate({ body: refreshBodySchema }), logoutHandler)
authRouter.post('/refresh', validate({ body: refreshBodySchema }), refreshHandler)
authRouter.get('/me', authenticate, meHandler)
