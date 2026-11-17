import { ROLES, USER_STATUSES } from '../constants/roles.js'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { env } from '../config/env.js'
import { logger } from '../lib/logger/index.js'
import { hashPassword } from '../lib/password/index.js'
import { User } from '../models/user.model.js'

async function main(): Promise<void> {
  if (!env.seedAdminEmail || !env.seedAdminPassword) {
    logger.info('Seed skipped because SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are not both set')
    return
  }

  await connectDatabase()
  const existing = await User.findOne({ email: env.seedAdminEmail })
  if (!existing) {
    await User.create({
      email: env.seedAdminEmail,
      name: 'Administrator',
      passwordHash: await hashPassword(env.seedAdminPassword),
      role: ROLES.ADMIN,
      status: USER_STATUSES.ACTIVE,
    })
  }

  logger.info('Administrator account is ready', { email: env.seedAdminEmail })
}

main()
  .catch((error: unknown) => {
    logger.error('Seed failed', { name: error instanceof Error ? error.name : 'Error' })
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDatabase()
  })
