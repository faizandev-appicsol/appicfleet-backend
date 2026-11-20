import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/**
 * Foundation indexes for identity and session collections.
 * Safe when Mongoose already created the same keys under default names (email_1, etc.).
 */
export const migration001FoundationIndexes: MigrationDefinition = {
  id: '001_foundation_indexes',
  name: 'Create foundation indexes for users and refresh tokens',
  async up({ db }) {
    const users = db.collection('users')
    await ensureIndex(users, { email: 1 }, { name: 'users_email_unique', unique: true })
    await ensureIndex(users, { role: 1 }, { name: 'users_role' })
    await ensureIndex(users, { status: 1 }, { name: 'users_status' })

    const refreshTokens = db.collection('refresh_tokens')
    await ensureIndex(refreshTokens, { tokenHash: 1 }, {
      name: 'refresh_tokens_tokenHash_unique',
      unique: true,
    })
    await ensureIndex(refreshTokens, { userId: 1 }, { name: 'refresh_tokens_userId' })
    await ensureIndex(refreshTokens, { expiresAt: 1 }, { name: 'refresh_tokens_expiresAt' })
  },
  async down({ db }) {
    const users = db.collection('users')
    await dropIndexIfExists(users, [
      'users_email_unique',
      'email_1',
      'users_role',
      'role_1',
      'users_status',
      'status_1',
    ])

    const refreshTokens = db.collection('refresh_tokens')
    await dropIndexIfExists(refreshTokens, [
      'refresh_tokens_tokenHash_unique',
      'tokenHash_1',
      'refresh_tokens_userId',
      'userId_1',
      'refresh_tokens_expiresAt',
      'expiresAt_1',
    ])
  },
}
