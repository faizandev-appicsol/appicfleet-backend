import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/** Module 10: fines, tolls/Salik, recoveries, disputes, imports, refunds. */
export const migration009Charges: MigrationDefinition = {
  id: '009_charges',
  name: 'Create fine, toll, recovery and refund indexes',
  async up({ db }) {
    await ensureIndex(db.collection('fines'), { organizationId: 1, provider: 1, externalReference: 1 }, { unique: true })
    await ensureIndex(
      db.collection('fines'),
      { organizationId: 1, documentNumber: 1 },
      { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('fines'), { organizationId: 1, branchId: 1, status: 1, eventAt: 1 })
    await ensureIndex(db.collection('fines'), { organizationId: 1, vehicleId: 1, eventAt: 1 })
    await ensureIndex(db.collection('fines'), { organizationId: 1, customerId: 1, eventAt: 1 })
    await ensureIndex(db.collection('fines'), { organizationId: 1, contractId: 1, eventAt: 1 })

    await ensureIndex(db.collection('tolls'), { organizationId: 1, provider: 1, externalReference: 1 }, { unique: true })
    await ensureIndex(
      db.collection('tolls'),
      { organizationId: 1, documentNumber: 1 },
      { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('tolls'), { organizationId: 1, branchId: 1, status: 1, eventAt: 1 })
    await ensureIndex(db.collection('tolls'), { organizationId: 1, vehicleId: 1, eventAt: 1 })
    await ensureIndex(db.collection('tolls'), { organizationId: 1, customerId: 1, eventAt: 1 })

    await ensureIndex(db.collection('charge_recoveries'), { organizationId: 1, sourceKind: 1, sourceId: 1 }, { unique: true })
    await ensureIndex(db.collection('charge_recoveries'), { organizationId: 1, idempotencyKey: 1 }, { unique: true })
    await ensureIndex(db.collection('charge_disputes'), { organizationId: 1, sourceKind: 1, sourceId: 1, createdAt: 1 })

    await ensureIndex(db.collection('fine_toll_import_batches'), { organizationId: 1, createdAt: -1 })
    await ensureIndex(db.collection('fine_toll_import_rows'), { batchId: 1, rowNumber: 1 }, { unique: true })

    await ensureIndex(db.collection('refunds'), { organizationId: 1, idempotencyKey: 1 }, { unique: true })
    await ensureIndex(
      db.collection('refunds'),
      { organizationId: 1, documentNumber: 1 },
      { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('refunds'), { organizationId: 1, customerId: 1, status: 1, createdAt: 1 })
    await ensureIndex(db.collection('refunds'), { organizationId: 1, branchId: 1, status: 1 })

    await ensureIndex(db.collection('charge_counters'), { organizationId: 1, name: 1 }, { unique: true })
    await ensureIndex(db.collection('charge_status_events'), { entityType: 1, entityId: 1, createdAt: 1 })

    // Event-time assignment lookups: startsAt <= t < endsAt
    await ensureIndex(db.collection('vehicle_assignments'), {
      vehicleId: 1,
      organizationId: 1,
      status: 1,
      startsAt: 1,
      endsAt: 1,
    })
  },
  async down({ db }) {
    const drop = (collection: string, names: string[]) =>
      Promise.all(names.map((name) => dropIndexIfExists(db.collection(collection), name)))
    await drop('fines', [
      'organizationId_1_provider_1_externalReference_1',
      'organizationId_1_documentNumber_1',
      'organizationId_1_branchId_1_status_1_eventAt_1',
      'organizationId_1_vehicleId_1_eventAt_1',
      'organizationId_1_customerId_1_eventAt_1',
      'organizationId_1_contractId_1_eventAt_1',
    ])
    await drop('tolls', [
      'organizationId_1_provider_1_externalReference_1',
      'organizationId_1_documentNumber_1',
      'organizationId_1_branchId_1_status_1_eventAt_1',
      'organizationId_1_vehicleId_1_eventAt_1',
      'organizationId_1_customerId_1_eventAt_1',
    ])
    await drop('charge_recoveries', [
      'organizationId_1_sourceKind_1_sourceId_1',
      'organizationId_1_idempotencyKey_1',
    ])
    await drop('charge_disputes', ['organizationId_1_sourceKind_1_sourceId_1_createdAt_1'])
    await drop('fine_toll_import_batches', ['organizationId_1_createdAt_-1'])
    await drop('fine_toll_import_rows', ['batchId_1_rowNumber_1'])
    await drop('refunds', [
      'organizationId_1_idempotencyKey_1',
      'organizationId_1_documentNumber_1',
      'organizationId_1_customerId_1_status_1_createdAt_1',
      'organizationId_1_branchId_1_status_1',
    ])
    await drop('charge_counters', ['organizationId_1_name_1'])
    await drop('charge_status_events', ['entityType_1_entityId_1_createdAt_1'])
    await drop('vehicle_assignments', ['vehicleId_1_organizationId_1_status_1_startsAt_1_endsAt_1'])
  },
}
