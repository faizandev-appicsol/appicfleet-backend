import mongoose from 'mongoose'
import { ensureIndexes } from '../database/indexes/ensure.js'
import { getMigrationStatus } from '../database/migrations/runner.js'
import { logger } from '../lib/logger/index.js'
import { env } from './env.js'

mongoose.set('strictQuery', true)

mongoose.connection.on('error', (error: Error) => {
  logger.error('MongoDB connection error', {
    module: 'database',
    name: error.name,
  })
})

type ConnectOptions = {
  /** Warn when registered migrations are not applied. Default true. */
  runPendingMigrationCheck?: boolean
  /** Sync Mongoose model indexes after connect. Default true. */
  syncIndexes?: boolean
}

export async function connectDatabase(options: ConnectOptions = {}): Promise<void> {
  const runPendingMigrationCheck = options.runPendingMigrationCheck ?? true
  const syncIndexes = options.syncIndexes ?? true

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 5_000,
  })

  if (syncIndexes) {
    await ensureIndexes()
  }

  if (runPendingMigrationCheck) {
    try {
      const status = await getMigrationStatus()
      if (status.pending.length > 0) {
        logger.warn('Pending MongoDB migrations detected. Run npm run db:migrate.', {
          module: 'database',
          operation: 'migration-check',
          pending: status.pending.map((row) => row.id),
        })
      }
    } catch (error) {
      logger.warn('Unable to check migration status', {
        module: 'database',
        name: error instanceof Error ? error.name : 'Error',
      })
    }
  }

  logger.info('MongoDB connected', {
    module: 'database',
    environment: env.nodeEnv,
  })
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) return
  await mongoose.disconnect()
}

export async function checkDatabase(): Promise<'up' | 'down'> {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDatabase({ runPendingMigrationCheck: false })
    }
    const db = mongoose.connection.db
    if (!db) return 'down'
    await db.command({ ping: 1 })
    return 'up'
  } catch (error) {
    logger.warn('Database health check failed', {
      module: 'database',
      name: error instanceof Error ? error.name : 'Error',
    })
    return 'down'
  }
}
