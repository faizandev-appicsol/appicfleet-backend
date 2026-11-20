import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/**
 * Module 4: vehicle management indexes.
 *
 * Collections: vehicles, vehicle_status_events, vehicle_documents, vehicle_rate_cards,
 * vehicle_assignments, vehicle_locks.
 *
 * Index names are left to MongoDB (default `<field>_<dir>` names) so they match what Mongoose
 * declares on the schemas; `ensureIndex` skips keys that already exist.
 *
 * Notable indexes:
 * - vehicles {organizationId, plateNumber} unique
 * - vehicles {organizationId, vin} unique, partial on `vin` being a string (vehicles without a
 *   VIN omit the field and never collide)
 * - vehicle_locks {vehicleId} unique: the mutex that makes assignment and rate writes race-safe
 *
 * Idempotent: safe to run again. `down` drops only the indexes created here.
 */
export const migration003Vehicles: MigrationDefinition = {
  id: '003_vehicles',
  name: 'Create vehicle management indexes',
  async up({ db }) {
    const vehicles = db.collection('vehicles')
    await ensureIndex(vehicles, { organizationId: 1 })
    await ensureIndex(vehicles, { organizationId: 1, plateNumber: 1 }, { unique: true })
    await ensureIndex(
      vehicles,
      { organizationId: 1, vin: 1 },
      { unique: true, partialFilterExpression: { vin: { $type: 'string' } } },
    )
    await ensureIndex(vehicles, { organizationId: 1, branchId: 1, status: 1 })
    await ensureIndex(vehicles, { organizationId: 1, status: 1 })
    await ensureIndex(vehicles, { organizationId: 1, complianceState: 1 })
    await ensureIndex(vehicles, { organizationId: 1, createdAt: -1 })

    const statusEvents = db.collection('vehicle_status_events')
    await ensureIndex(statusEvents, { vehicleId: 1, createdAt: -1 })
    await ensureIndex(statusEvents, { organizationId: 1, createdAt: -1 })

    const documents = db.collection('vehicle_documents')
    await ensureIndex(documents, { vehicleId: 1, status: 1, createdAt: -1 })
    await ensureIndex(documents, { organizationId: 1, expiresOn: 1 })

    const rateCards = db.collection('vehicle_rate_cards')
    await ensureIndex(rateCards, { vehicleId: 1, rateType: 1, status: 1, effectiveFrom: -1 })

    const assignments = db.collection('vehicle_assignments')
    await ensureIndex(assignments, { vehicleId: 1, status: 1, startsAt: 1, endsAt: 1 })
    await ensureIndex(assignments, { organizationId: 1, branchId: 1, startsAt: 1 })

    const locks = db.collection('vehicle_locks')
    await ensureIndex(locks, { vehicleId: 1 }, { unique: true })
  },
  async down({ db }) {
    await dropIndexIfExists(db.collection('vehicle_locks'), ['vehicleId_1'])
    await dropIndexIfExists(db.collection('vehicle_assignments'), [
      'vehicleId_1_status_1_startsAt_1_endsAt_1',
      'organizationId_1_branchId_1_startsAt_1',
    ])
    await dropIndexIfExists(db.collection('vehicle_rate_cards'), [
      'vehicleId_1_rateType_1_status_1_effectiveFrom_-1',
    ])
    await dropIndexIfExists(db.collection('vehicle_documents'), [
      'vehicleId_1_status_1_createdAt_-1',
      'organizationId_1_expiresOn_1',
    ])
    await dropIndexIfExists(db.collection('vehicle_status_events'), [
      'vehicleId_1_createdAt_-1',
      'organizationId_1_createdAt_-1',
    ])
    await dropIndexIfExists(db.collection('vehicles'), [
      'organizationId_1',
      'organizationId_1_plateNumber_1',
      'organizationId_1_vin_1',
      'organizationId_1_branchId_1_status_1',
      'organizationId_1_status_1',
      'organizationId_1_complianceState_1',
      'organizationId_1_createdAt_-1',
    ])
  },
}
