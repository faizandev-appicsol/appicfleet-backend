import type { AuthenticatedUser } from './auth.js'
import type { ValidatedRequestData } from './http.js'

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
      validated?: ValidatedRequestData
    }
  }
}

export {}
