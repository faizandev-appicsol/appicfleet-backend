import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/** Module 14: Investor portal identity, invitations, and access scope indexes. */
export const migration013Investors: MigrationDefinition = {
  id: '013_investors',
  name: 'Create investor portal indexes',
  async up({ db }) {
    await ensureIndex(db.collection('investors'), { organizationId: 1, investorNumber: 1 }, { unique: true })
    await ensureIndex(db.collection('investors'), { userId: 1 }, { unique: true })
    await ensureIndex(db.collection('investors'), { organizationId: 1, status: 1, displayName: 1 })
    await ensureIndex(db.collection('investors'), { organizationId: 1, contactEmail: 1 })
    await ensureIndex(db.collection('investors'), { 'scope.branchIds': 1 })
    await ensureIndex(db.collection('investors'), { 'scope.legalEntityIds': 1 })
    await ensureIndex(db.collection('investors'), { 'scope.vehicleIds': 1 })

    await ensureIndex(db.collection('investor_invitations'), { tokenHash: 1 }, { unique: true })
    await ensureIndex(db.collection('investor_invitations'), { investorId: 1, createdAt: -1 })
    await ensureIndex(db.collection('investor_invitations'), { expiresAt: 1 })

    await ensureIndex(db.collection('investor_counters'), { organizationId: 1, name: 1 }, { unique: true })
  },
  async down({ db }) {
    const drop = (collection: string, names: string[]) =>
      Promise.all(names.map((name) => dropIndexIfExists(db.collection(collection), name)))
    await drop('investors', [
      'organizationId_1_investorNumber_1',
      'userId_1',
      'organizationId_1_status_1_displayName_1',
      'organizationId_1_contactEmail_1',
      'scope.branchIds_1',
      'scope.legalEntityIds_1',
      'scope.vehicleIds_1',
    ])
    await drop('investor_invitations', ['tokenHash_1', 'investorId_1_createdAt_-1', 'expiresAt_1'])
    await drop('investor_counters', ['organizationId_1_name_1'])
  },
}
