import { app } from './app.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { env } from './config/env.js'
import { logger } from './lib/logger/index.js'
import { registerBookingJobs } from './services/bookings/hold-expiry.js'
import { startScheduler } from './services/jobs/scheduler.js'
import { registerRecruitmentJobs } from './services/recruitment/recruitment-jobs.js'

registerBookingJobs()
registerRecruitmentJobs()
startScheduler()

const server = app.listen(env.port, () => {
  logger.info('API listening', {
    module: 'server',
    service: env.appName,
    port: env.port,
    environment: env.nodeEnv,
  })
})

connectDatabase().catch((error: unknown) => {
  logger.warn('MongoDB is unavailable. Health will report the database as down.', {
    name: error instanceof Error ? error.name : 'Error',
  })
})

let shuttingDown = false

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  logger.info('Shutting down', { signal })

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  await disconnectDatabase()
}

function onSignal(signal: string): void {
  shutdown(signal)
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logger.error('Shutdown failed', { name: error instanceof Error ? error.name : 'Error' })
      process.exit(1)
    })
}

process.on('SIGINT', () => onSignal('SIGINT'))
process.on('SIGTERM', () => onSignal('SIGTERM'))

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', { name: reason instanceof Error ? reason.name : 'Error' })
})

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { name: error.name })
  process.exit(1)
})
