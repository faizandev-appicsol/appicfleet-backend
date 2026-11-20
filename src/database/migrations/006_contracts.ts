import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/**
 * Module 7: contract indexes.
 *
 * Vehicle windows stay in `vehicle_assignments`. A contract id on that row is a link, not a second
 * availability store. Overlap is still decided under `vehicle_locks` (MongoDB has no exclusion
 * constraint here). See docs/architecture/contracts.md.
 */
export const migration006Contracts: MigrationDefinition = {
  id: '006_contracts',
  name: 'Create contract indexes',
  async up({ db }) {
    const contracts = db.collection('contracts')
    await ensureIndex(contracts, { organizationId: 1, contractNumber: 1 }, { unique: true })
    await ensureIndex(contracts, { organizationId: 1, branchId: 1, status: 1, startsAt: 1 })
    await ensureIndex(contracts, { organizationId: 1, customerId: 1, startsAt: 1 })
    await ensureIndex(contracts, { organizationId: 1, currentVehicleId: 1, startsAt: 1 })
    await ensureIndex(contracts, { bookingId: 1 }, { unique: true, partialFilterExpression: { bookingId: { $type: 'objectId' } } })

    await ensureIndex(db.collection('contract_terms_versions'), { contractId: 1, version: 1 }, { unique: true })
    await ensureIndex(db.collection('contract_charges'), { contractId: 1, kind: 1, sourceId: 1 }, { unique: true })
    await ensureIndex(db.collection('contract_pricing_amendments'), { contractId: 1, createdAt: 1 })
    await ensureIndex(db.collection('contract_extensions'), { contractId: 1, startsAt: 1 }, { unique: true })
    await ensureIndex(db.collection('contract_replacements'), { contractId: 1, occurredAt: 1 })
    await ensureIndex(db.collection('contract_handovers'), { contractId: 1 }, { unique: true })
    await ensureIndex(db.collection('contract_returns'), { contractId: 1 }, { unique: true })
    await ensureIndex(db.collection('contract_signatures'), { contractId: 1, termsVersionId: 1, signerName: 1 }, { unique: true })
    await ensureIndex(
      db.collection('contract_signatures'),
      { organizationId: 1, externalEventId: 1 },
      { unique: true, partialFilterExpression: { externalEventId: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('contract_status_events'), { contractId: 1, createdAt: 1 })
    await ensureIndex(db.collection('contract_counters'), { organizationId: 1, name: 1 }, { unique: true })
    await ensureIndex(db.collection('contract_idempotency_keys'), { organizationId: 1, key: 1 }, { unique: true })
    await ensureIndex(db.collection('vehicle_assignments'), { contractId: 1, startsAt: 1 })
  },
  async down({ db }) {
    const drop = async (name: string, indexes: string[]) => {
      const collection = db.collection(name)
      for (const index of indexes) await dropIndexIfExists(collection, index)
    }
    await drop('contracts', [
      'organizationId_1_contractNumber_1',
      'organizationId_1_branchId_1_status_1_startsAt_1',
      'organizationId_1_customerId_1_startsAt_1',
      'organizationId_1_currentVehicleId_1_startsAt_1',
      'bookingId_1',
    ])
    await drop('contract_terms_versions', ['contractId_1_version_1'])
    await drop('contract_charges', ['contractId_1_kind_1_sourceId_1'])
    await drop('contract_pricing_amendments', ['contractId_1_createdAt_1'])
    await drop('contract_extensions', ['contractId_1_startsAt_1'])
    await drop('contract_replacements', ['contractId_1_occurredAt_1'])
    await drop('contract_handovers', ['contractId_1'])
    await drop('contract_returns', ['contractId_1'])
    await drop('contract_signatures', ['contractId_1_termsVersionId_1_signerName_1', 'organizationId_1_externalEventId_1'])
    await drop('contract_status_events', ['contractId_1_createdAt_1'])
    await drop('contract_counters', ['organizationId_1_name_1'])
    await drop('contract_idempotency_keys', ['organizationId_1_key_1'])
    await drop('vehicle_assignments', ['contractId_1_startsAt_1'])
  },
}
