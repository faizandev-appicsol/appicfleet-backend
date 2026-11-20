import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/**
 * Module 5: customer indexes.
 *
 * Collections: customers, customer_contacts, customer_documents, customer_ocr_runs,
 * customer_duplicate_reviews.
 *
 * Index names are left to MongoDB (default `<field>_<dir>` names) so they match what Mongoose
 * declares on the schemas; `ensureIndex` skips keys that already exist.
 *
 * Notable indexes:
 * - customers {organizationId, customerNumber} unique
 * - customer_documents {organizationId, sha256, customerId} unique: the same file twice for one
 *   customer is rejected, the same file for another customer is allowed (and flagged)
 * - customer_duplicate_reviews {organizationId, customerId, candidateId} unique: the pair is
 *   stored in canonical order (customerId < candidateId), so A-B and B-A cannot both exist
 *
 * Idempotent: safe to run again. `down` drops only the indexes created here.
 */
export const migration004Customers: MigrationDefinition = {
  id: '004_customers',
  name: 'Create customer management indexes',
  async up({ db }) {
    const customers = db.collection('customers')
    await ensureIndex(customers, { organizationId: 1, customerNumber: 1 }, { unique: true })
    await ensureIndex(customers, { organizationId: 1, normalizedEmail: 1 })
    await ensureIndex(customers, { organizationId: 1, normalizedPhone: 1 })
    await ensureIndex(customers, { organizationId: 1, branchId: 1, status: 1 })
    await ensureIndex(customers, { organizationId: 1, type: 1 })

    const contacts = db.collection('customer_contacts')
    await ensureIndex(contacts, { organizationId: 1, customerId: 1, status: 1 })

    const documents = db.collection('customer_documents')
    await ensureIndex(documents, { organizationId: 1, sha256: 1, customerId: 1 }, { unique: true })
    await ensureIndex(documents, { customerId: 1, status: 1, createdAt: -1 })

    const ocrRuns = db.collection('customer_ocr_runs')
    await ensureIndex(ocrRuns, { documentId: 1, createdAt: -1 })
    await ensureIndex(ocrRuns, { organizationId: 1, customerId: 1 })
    await ensureIndex(ocrRuns, { organizationId: 1, 'fields.value': 1 })

    const reviews = db.collection('customer_duplicate_reviews')
    await ensureIndex(reviews, { organizationId: 1, customerId: 1, candidateId: 1 }, { unique: true })
    await ensureIndex(reviews, { organizationId: 1, candidateId: 1 })
  },
  async down({ db }) {
    await dropIndexIfExists(db.collection('customer_duplicate_reviews'), [
      'organizationId_1_customerId_1_candidateId_1',
      'organizationId_1_candidateId_1',
    ])
    await dropIndexIfExists(db.collection('customer_ocr_runs'), [
      'documentId_1_createdAt_-1',
      'organizationId_1_customerId_1',
      'organizationId_1_fields.value_1',
    ])
    await dropIndexIfExists(db.collection('customer_documents'), [
      'organizationId_1_sha256_1_customerId_1',
      'customerId_1_status_1_createdAt_-1',
    ])
    await dropIndexIfExists(db.collection('customer_contacts'), [
      'organizationId_1_customerId_1_status_1',
    ])
    await dropIndexIfExists(db.collection('customers'), [
      'organizationId_1_customerNumber_1',
      'organizationId_1_normalizedEmail_1',
      'organizationId_1_normalizedPhone_1',
      'organizationId_1_branchId_1_status_1',
      'organizationId_1_type_1',
    ])
  },
}
