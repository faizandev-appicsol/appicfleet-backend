import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/** Module 12: VAT configuration, tax transactions, tax periods, e-invoice documents/submissions. */
export const migration011TaxEinvoicing: MigrationDefinition = {
  id: '011_tax_einvoicing',
  name: 'Create tax and e-invoicing indexes',
  async up({ db }) {
    await ensureIndex(db.collection('tax_codes'), { organizationId: 1, code: 1 }, { unique: true })
    await ensureIndex(db.collection('tax_codes'), { organizationId: 1, isActive: 1 })

    await ensureIndex(db.collection('tax_rates'), { organizationId: 1, taxCodeId: 1, effectiveFrom: 1 })
    await ensureIndex(db.collection('tax_rates'), { taxCodeId: 1, effectiveFrom: 1, effectiveTo: 1 })

    await ensureIndex(db.collection('tax_configurations'), { organizationId: 1, legalEntityId: 1 }, { unique: true })

    await ensureIndex(
      db.collection('tax_periods'),
      { organizationId: 1, legalEntityId: 1, taxYear: 1, periodNumber: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('tax_periods'), { organizationId: 1, legalEntityId: 1, status: 1, startDate: 1 })

    await ensureIndex(db.collection('tax_transactions'), { organizationId: 1, idempotencyKey: 1 }, { unique: true })
    await ensureIndex(db.collection('tax_transactions'), { organizationId: 1, sourceType: 1, sourceId: 1 })
    await ensureIndex(db.collection('tax_transactions'), {
      organizationId: 1,
      legalEntityId: 1,
      transactionDate: -1,
    })
    await ensureIndex(db.collection('tax_transactions'), { organizationId: 1, taxPeriodId: 1, taxCode: 1 })
    await ensureIndex(db.collection('tax_transactions'), { organizationId: 1, branchId: 1, transactionDate: -1 })

    await ensureIndex(
      db.collection('einvoice_documents'),
      { organizationId: 1, sourceType: 1, sourceId: 1, documentVersion: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('einvoice_documents'), { organizationId: 1, submissionIdempotencyKey: 1 }, { unique: true })
    await ensureIndex(db.collection('einvoice_documents'), { organizationId: 1, status: 1, issueDate: -1 })
    await ensureIndex(db.collection('einvoice_documents'), { organizationId: 1, providerReference: 1 })
    await ensureIndex(db.collection('einvoice_documents'), {
      organizationId: 1,
      legalEntityId: 1,
      branchId: 1,
      status: 1,
    })

    await ensureIndex(db.collection('einvoice_submissions'), { organizationId: 1, requestIdempotencyKey: 1 }, { unique: true })
    await ensureIndex(db.collection('einvoice_submissions'), { einvoiceDocumentId: 1, attemptNumber: 1 }, { unique: true })
    await ensureIndex(db.collection('einvoice_submissions'), { organizationId: 1, createdAt: -1 })

    await ensureIndex(db.collection('tax_status_events'), { entityType: 1, entityId: 1, createdAt: 1 })
  },
  async down({ db }) {
    const drop = (collection: string, names: string[]) =>
      Promise.all(names.map((name) => dropIndexIfExists(db.collection(collection), name)))
    await drop('tax_codes', ['organizationId_1_code_1', 'organizationId_1_isActive_1'])
    await drop('tax_rates', ['organizationId_1_taxCodeId_1_effectiveFrom_1', 'taxCodeId_1_effectiveFrom_1_effectiveTo_1'])
    await drop('tax_configurations', ['organizationId_1_legalEntityId_1'])
    await drop('tax_periods', [
      'organizationId_1_legalEntityId_1_taxYear_1_periodNumber_1',
      'organizationId_1_legalEntityId_1_status_1_startDate_1',
    ])
    await drop('tax_transactions', [
      'organizationId_1_idempotencyKey_1',
      'organizationId_1_sourceType_1_sourceId_1',
      'organizationId_1_legalEntityId_1_transactionDate_-1',
      'organizationId_1_taxPeriodId_1_taxCode_1',
      'organizationId_1_branchId_1_transactionDate_-1',
    ])
    await drop('einvoice_documents', [
      'organizationId_1_sourceType_1_sourceId_1_documentVersion_1',
      'organizationId_1_submissionIdempotencyKey_1',
      'organizationId_1_status_1_issueDate_-1',
      'organizationId_1_providerReference_1',
      'organizationId_1_legalEntityId_1_branchId_1_status_1',
    ])
    await drop('einvoice_submissions', [
      'organizationId_1_requestIdempotencyKey_1',
      'einvoiceDocumentId_1_attemptNumber_1',
      'organizationId_1_createdAt_-1',
    ])
    await drop('tax_status_events', ['entityType_1_entityId_1_createdAt_1'])
  },
}
