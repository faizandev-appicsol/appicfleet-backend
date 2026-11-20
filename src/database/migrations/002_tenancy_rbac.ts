import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/**
 * Module 3: tenancy, RBAC and audit.
 *
 * - Creates collections' indexes for organizations, legal_entities, branches, roles, audit_events.
 * - Adds tenancy indexes on users.
 * - Backfills the new user fields on existing documents and renames the legacy DISABLED status
 *   to INACTIVE.
 *
 * Index names are left to MongoDB (default `<field>_<dir>` names) so they match what Mongoose
 * declares on the schemas; `ensureIndex` skips keys that already exist, so the migration and
 * `syncIndexes` never fight over the same key.
 *
 * Idempotent: every step is safe to run again. Existing users have no organizationId and cannot
 * access tenant data until `npm run db:seed` (or an operator) assigns one.
 */
export const migration002TenancyRbac: MigrationDefinition = {
  id: '002_tenancy_rbac',
  name: 'Create tenancy, RBAC and audit indexes; backfill user tenancy fields',
  async up({ db }) {
    const organizations = db.collection('organizations')
    await ensureIndex(organizations, { code: 1 }, { unique: true })
    await ensureIndex(organizations, { status: 1 })

    const legalEntities = db.collection('legal_entities')
    await ensureIndex(legalEntities, { organizationId: 1, status: 1 })
    await ensureIndex(legalEntities, { organizationId: 1, legalName: 1 })

    const branches = db.collection('branches')
    await ensureIndex(branches, { organizationId: 1, code: 1 }, { unique: true })
    await ensureIndex(branches, { organizationId: 1, legalEntityId: 1 })
    await ensureIndex(branches, { organizationId: 1, status: 1 })

    const roles = db.collection('roles')
    await ensureIndex(roles, { organizationId: 1, code: 1 }, { unique: true })
    await ensureIndex(roles, { organizationId: 1, status: 1 })
    await ensureIndex(roles, { isSystem: 1 })

    const auditEvents = db.collection('audit_events')
    await ensureIndex(auditEvents, { organizationId: 1, createdAt: -1 })
    await ensureIndex(auditEvents, { actorUserId: 1, createdAt: -1 })
    await ensureIndex(auditEvents, { action: 1, createdAt: -1 })
    await ensureIndex(auditEvents, { entityType: 1, entityId: 1 })
    await ensureIndex(auditEvents, { requestId: 1 }, { sparse: true })

    const users = db.collection('users')
    await ensureIndex(users, { organizationId: 1, status: 1 })
    await ensureIndex(users, { organizationId: 1, email: 1 })
    await ensureIndex(users, { branchIds: 1 })

    // Backfill: only touches documents that are missing a field, so re-running is a no-op.
    await users.updateMany({ status: 'DISABLED' }, { $set: { status: 'INACTIVE' } })
    await users.updateMany({ legalEntityIds: { $exists: false } }, { $set: { legalEntityIds: [] } })
    await users.updateMany({ branchIds: { $exists: false } }, { $set: { branchIds: [] } })
    await users.updateMany({ roleIds: { $exists: false } }, { $set: { roleIds: [] } })
    await users.updateMany(
      { accessAllBranches: { $exists: false } },
      { $set: { accessAllBranches: false } },
    )
    await users.updateMany(
      { accessAllOrganizations: { $exists: false } },
      { $set: { accessAllOrganizations: false } },
    )
    await users.updateMany(
      { failedLoginAttempts: { $exists: false } },
      { $set: { failedLoginAttempts: 0 } },
    )
  },
  async down({ db }) {
    // Only indexes are removed. Backfilled fields and the DISABLED -> INACTIVE rename are kept:
    // older code reads INACTIVE as an unknown status, so rolling the data back would not help.
    await dropIndexIfExists(db.collection('users'), [
      'organizationId_1_status_1',
      'organizationId_1_email_1',
      'branchIds_1',
    ])
    await dropIndexIfExists(db.collection('audit_events'), [
      'organizationId_1_createdAt_-1',
      'actorUserId_1_createdAt_-1',
      'action_1_createdAt_-1',
      'entityType_1_entityId_1',
      'requestId_1',
    ])
    await dropIndexIfExists(db.collection('roles'), [
      'organizationId_1_code_1',
      'organizationId_1_status_1',
      'isSystem_1',
    ])
    await dropIndexIfExists(db.collection('branches'), [
      'organizationId_1_code_1',
      'organizationId_1_legalEntityId_1',
      'organizationId_1_status_1',
    ])
    await dropIndexIfExists(db.collection('legal_entities'), [
      'organizationId_1_status_1',
      'organizationId_1_legalName_1',
    ])
    await dropIndexIfExists(db.collection('organizations'), ['code_1', 'status_1'])
  },
}
