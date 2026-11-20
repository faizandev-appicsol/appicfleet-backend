import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

export const migration020VehicleTypes: MigrationDefinition = {
  id: '020_vehicle_types',
  name: 'Create vehicle_types indexes',
  async up({ db }) {
    const types = db.collection('vehicle_types')
    await ensureIndex(types, { organizationId: 1, userId: 1, normalizedName: 1 }, { unique: true })
    await ensureIndex(types, { organizationId: 1, userId: 1, name: 1 })
  },
  async down({ db }) {
    const types = db.collection('vehicle_types')
    await dropIndexIfExists(types, 'organizationId_1_userId_1_normalizedName_1')
    await dropIndexIfExists(types, 'organizationId_1_userId_1_name_1')
  },
}
