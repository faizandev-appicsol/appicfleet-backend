import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/**
 * Soft-delete support for vehicles:
 * - `deletedAt` / `deletedBy` fields (documents are never hard-removed)
 * - unique plate/VIN indexes only apply to non-deleted rows so plates can be reused later
 */
export const migration021VehicleSoftDelete: MigrationDefinition = {
  id: '021_vehicle_soft_delete',
  name: 'Add vehicle soft-delete indexes',
  async up({ db }) {
    const vehicles = db.collection('vehicles')
    await dropIndexIfExists(vehicles, 'organizationId_1_plateNumber_1')
    await dropIndexIfExists(vehicles, 'organizationId_1_vin_1')
    await ensureIndex(
      vehicles,
      { organizationId: 1, plateNumber: 1 },
      { unique: true, partialFilterExpression: { deletedAt: null } },
    )
    await ensureIndex(
      vehicles,
      { organizationId: 1, vin: 1 },
      { unique: true, partialFilterExpression: { vin: { $type: 'string' }, deletedAt: null } },
    )
    await ensureIndex(vehicles, { organizationId: 1, deletedAt: 1 })
  },
  async down({ db }) {
    const vehicles = db.collection('vehicles')
    await dropIndexIfExists(vehicles, 'organizationId_1_plateNumber_1')
    await dropIndexIfExists(vehicles, 'organizationId_1_vin_1')
    await dropIndexIfExists(vehicles, 'organizationId_1_deletedAt_1')
    await ensureIndex(vehicles, { organizationId: 1, plateNumber: 1 }, { unique: true })
    await ensureIndex(
      vehicles,
      { organizationId: 1, vin: 1 },
      { unique: true, partialFilterExpression: { vin: { $type: 'string' } } },
    )
  },
}
