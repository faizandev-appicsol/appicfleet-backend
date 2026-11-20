import { connectDatabase, disconnectDatabase } from '../../config/database.js'
import { logger } from '../../lib/logger/index.js'
import { getMigrationStatus, migrateDownLast, migrateUp } from './runner.js'

type Command = 'up' | 'down' | 'status'

function readCommand(argv: string[]): Command {
  const value = argv[2]
  if (value === 'up' || value === 'down' || value === 'status') return value
  throw new Error('Usage: tsx src/database/migrations/cli.ts <up|down|status>')
}

async function main(): Promise<void> {
  const command = readCommand(process.argv)
  await connectDatabase({ runPendingMigrationCheck: false, syncIndexes: false })

  if (command === 'status') {
    const status = await getMigrationStatus()
    logger.info('Migration status', {
      module: 'migrations',
      operation: 'status',
      appliedCount: status.applied.length,
      pendingCount: status.pending.length,
      applied: status.applied.map((row) => row.id),
      pending: status.pending.map((row) => row.id),
    })
    return
  }

  if (command === 'up') {
    const result = await migrateUp()
    logger.info('Migrations complete', {
      module: 'migrations',
      operation: 'up',
      appliedCount: result.applied.length,
      applied: result.applied,
    })
    return
  }

  const result = await migrateDownLast()
  logger.info('Migration down complete', {
    module: 'migrations',
    operation: 'down',
    reverted: result.reverted,
  })
}

main()
  .catch((error: unknown) => {
    logger.error('Migration command failed', {
      module: 'migrations',
      name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDatabase()
  })
