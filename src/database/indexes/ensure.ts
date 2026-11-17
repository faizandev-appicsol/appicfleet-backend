import { RefreshToken } from '../../models/refresh-token.model.js'
import { User } from '../../models/user.model.js'

export async function ensureIndexes(): Promise<void> {
  await Promise.all([User.syncIndexes(), RefreshToken.syncIndexes()])
}
