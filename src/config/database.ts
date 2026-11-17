import mongoose from 'mongoose'
import { logger } from '../lib/logger/index.js'
import { ensureIndexes } from '../database/indexes/ensure.js'
import { env } from './env.js'

mongoose.set('strictQuery', true)

mongoose.connection.on('error', (error: Error) => {
  logger.error('MongoDB connection error', { name: error.name })
})

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 5_000,
  })
  await ensureIndexes()
  logger.info('MongoDB connected')
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) return
  await mongoose.disconnect()
}

export async function checkDatabase(): Promise<'up' | 'down'> {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDatabase()
    }
    const db = mongoose.connection.db
    if (!db) return 'down'
    await db.command({ ping: 1 })
    return 'up'
  } catch (error) {
    logger.warn('Database health check failed', {
      name: error instanceof Error ? error.name : 'Error',
    })
    return 'down'
  }
}
