import type { Db } from 'mongodb'

export type MigrationContext = {
  db: Db
}

export type MigrationDefinition = {
  /** Stable ordered id, e.g. 001_foundation_indexes */
  id: string
  name: string
  up: (context: MigrationContext) => Promise<void>
  down?: (context: MigrationContext) => Promise<void>
}

export type AppliedMigration = {
  id: string
  name: string
  appliedAt: Date
}
