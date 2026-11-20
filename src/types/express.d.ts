import type { AccessContext } from './access.js'
import type { AuthenticatedUser } from './auth.js'
import type { ValidatedRequestData } from './http.js'

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
      access?: AccessContext
      validated?: ValidatedRequestData
      requestId?: string
      correlationId?: string
    }
  }
}

export {}
