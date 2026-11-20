import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/**
 * Module 6: booking indexes.
 *
 * Overlap is not a Mongo exclusion constraint (this database is not PostgreSQL). Concurrent
 * reservations are serialized by the existing unique `vehicle_locks` document, and the overlap
 * check runs while that lock is held. See docs/architecture/bookings.md.
 *
 * Idempotency and webhook rows are unique so a repeated key or event id cannot insert twice.
 */
export const migration005Bookings: MigrationDefinition = {
  id: '005_bookings',
  name: 'Create booking indexes',
  async up({ db }) {
    const bookings = db.collection('bookings')
    await ensureIndex(bookings, { organizationId: 1, bookingNumber: 1 }, { unique: true })
    await ensureIndex(bookings, { organizationId: 1, branchId: 1, status: 1, startsAt: 1 })
    await ensureIndex(bookings, { organizationId: 1, vehicleId: 1, startsAt: 1, endsAt: 1 })
    await ensureIndex(bookings, { organizationId: 1, customerId: 1, startsAt: 1 })
    await ensureIndex(bookings, { organizationId: 1, startsAt: 1, endsAt: 1 })
    await ensureIndex(bookings, { status: 1, holdExpiresAt: 1 })
    await ensureIndex(
      bookings,
      { organizationId: 1, source: 1, externalReference: 1 },
      {
        unique: true,
        partialFilterExpression: { externalReference: { $type: 'string' } },
      },
    )

    await ensureIndex(db.collection('booking_status_events'), { bookingId: 1, createdAt: 1 })
    await ensureIndex(db.collection('booking_idempotency_keys'), { organizationId: 1, key: 1 }, { unique: true })
    await ensureIndex(
      db.collection('booking_intake_events'),
      { organizationId: 1, source: 1, externalEventId: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('booking_counters'), { organizationId: 1, name: 1 }, { unique: true })
  },
  async down({ db }) {
    await dropIndexIfExists(db.collection('booking_counters'), ['organizationId_1_name_1'])
    await dropIndexIfExists(db.collection('booking_intake_events'), [
      'organizationId_1_source_1_externalEventId_1',
    ])
    await dropIndexIfExists(db.collection('booking_idempotency_keys'), ['organizationId_1_key_1'])
    await dropIndexIfExists(db.collection('booking_status_events'), ['bookingId_1_createdAt_1'])
    await dropIndexIfExists(db.collection('bookings'), [
      'organizationId_1_bookingNumber_1',
      'organizationId_1_branchId_1_status_1_startsAt_1',
      'organizationId_1_vehicleId_1_startsAt_1_endsAt_1',
      'organizationId_1_customerId_1_startsAt_1',
      'organizationId_1_startsAt_1_endsAt_1',
      'status_1_holdExpiresAt_1',
      'organizationId_1_source_1_externalReference_1',
    ])
  },
}
