import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

export const migration019VehicleMakes: MigrationDefinition = {
  id: '019_vehicle_makes',
  name: 'Create vehicle_makes indexes',
  async up({ db }) {
    const makes = db.collection('vehicle_makes')
    await ensureIndex(makes, { organizationId: 1, userId: 1, normalizedName: 1 }, { unique: true })
    await ensureIndex(makes, { organizationId: 1, userId: 1, name: 1 })
  },
  async down({ db }) {
    const makes = db.collection('vehicle_makes')
    await dropIndexIfExists(makes, 'organizationId_1_userId_1_normalizedName_1')
    await dropIndexIfExists(makes, 'organizationId_1_userId_1_name_1')
  },
}
