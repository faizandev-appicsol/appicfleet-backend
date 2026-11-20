import mongoose from 'mongoose'
import { logger } from '../../lib/logger/index.js'
import { migrations } from './registry.js'
import type { AppliedMigration, MigrationDefinition } from './types.js'

const MIGRATIONS_COLLECTION = '_migrations'

async function getDb() {
  const db = mongoose.connection.db
  if (!db) {
    throw new Error('MongoDB is not connected. Call connectDatabase() before running migrations.')
  }
  return db
}

async function ensureMigrationStore(): Promise<void> {
  const db = await getDb()
  const collection = db.collection(MIGRATIONS_COLLECTION)
  await collection.createIndex({ id: 1 }, { unique: true, name: 'migrations_id_unique' })
}

export async function listAppliedMigrations(): Promise<AppliedMigration[]> {
  await ensureMigrationStore()
  const db = await getDb()
  const rows = await db
    .collection<AppliedMigration>(MIGRATIONS_COLLECTION)
    .find({})
    .sort({ id: 1 })
    .toArray()
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    appliedAt: row.appliedAt,
  }))
}

export async function listPendingMigrations(): Promise<MigrationDefinition[]> {
  const applied = new Set((await listAppliedMigrations()).map((row) => row.id))
  return migrations.filter((migration) => !applied.has(migration.id))
}

export async function migrateUp(): Promise<{ applied: string[] }> {
  await ensureMigrationStore()
  const db = await getDb()
  const pending = await listPendingMigrations()
  const applied: string[] = []

  for (const migration of pending) {
    logger.info('Applying migration', { module: 'migrations', operation: 'up', id: migration.id })
    await migration.up({ db })
    await db.collection(MIGRATIONS_COLLECTION).insertOne({
      id: migration.id,
      name: migration.name,
      appliedAt: new Date(),
    })
    applied.push(migration.id)
    logger.info('Migration applied', { module: 'migrations', operation: 'up', id: migration.id })
  }

  return { applied }
}

export async function migrateDownLast(): Promise<{ reverted: string | null }> {
  await ensureMigrationStore()
  const db = await getDb()
  const applied = await listAppliedMigrations()
  const last = applied.at(-1)
  if (!last) return { reverted: null }

  const definition = migrations.find((migration) => migration.id === last.id)
  if (!definition) {
    throw new Error(`Applied migration "${last.id}" is not present in the registry.`)
  }
  if (!definition.down) {
    throw new Error(`Migration "${last.id}" does not define a down() handler.`)
  }

  logger.info('Reverting migration', { module: 'migrations', operation: 'down', id: last.id })
  await definition.down({ db })
  await db.collection(MIGRATIONS_COLLECTION).deleteOne({ id: last.id })
  logger.info('Migration reverted', { module: 'migrations', operation: 'down', id: last.id })

  return { reverted: last.id }
}

export async function getMigrationStatus(): Promise<{
  applied: AppliedMigration[]
  pending: Array<{ id: string; name: string }>
}> {
  const applied = await listAppliedMigrations()
  const pending = (await listPendingMigrations()).map((migration) => ({
    id: migration.id,
    name: migration.name,
  }))
  return { applied, pending }
}
