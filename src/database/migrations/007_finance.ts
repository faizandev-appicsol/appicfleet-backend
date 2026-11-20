import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/**
 * Module 8: invoices, payments, receipts, credit/debit notes, deposits.
 * Accounting journals and VAT clearance are out of scope (later modules).
 */
export const migration007Finance: MigrationDefinition = {
  id: '007_finance',
  name: 'Create finance indexes',
  async up({ db }) {
    await ensureIndex(
      db.collection('invoices'),
      { organizationId: 1, documentNumber: 1 },
      { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('invoices'), { organizationId: 1, branchId: 1, status: 1, documentDate: 1 })
    await ensureIndex(db.collection('invoices'), { organizationId: 1, customerId: 1, documentDate: 1 })
    await ensureIndex(db.collection('invoices'), { organizationId: 1, contractId: 1, documentDate: 1 })
    await ensureIndex(db.collection('invoices'), { organizationId: 1, dueDate: 1, status: 1 })

    await ensureIndex(db.collection('invoice_lines'), { invoiceId: 1, sortOrder: 1 })
    await ensureIndex(
      db.collection('invoice_lines'),
      { organizationId: 1, sourceType: 1, sourceId: 1 },
      {
        unique: true,
        partialFilterExpression: { sourceType: 'CONTRACT_CHARGE', sourceId: { $type: 'string' } },
      },
    )

    await ensureIndex(
      db.collection('payments'),
      { organizationId: 1, paymentNumber: 1 },
      { unique: true, partialFilterExpression: { paymentNumber: { $type: 'string' } } },
    )
    await ensureIndex(
      db.collection('payments'),
      { organizationId: 1, externalReference: 1 },
      { unique: true, partialFilterExpression: { externalReference: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('payments'), { organizationId: 1, branchId: 1, status: 1, paymentDate: 1 })
    await ensureIndex(db.collection('payments'), { organizationId: 1, customerId: 1, paymentDate: 1 })

    await ensureIndex(db.collection('payment_allocations'), { paymentId: 1, invoiceId: 1 }, { unique: true })
    await ensureIndex(db.collection('payment_allocations'), { invoiceId: 1, createdAt: 1 })

    await ensureIndex(db.collection('receipts'), { organizationId: 1, receiptNumber: 1 }, { unique: true })
    await ensureIndex(db.collection('receipts'), { paymentId: 1 }, { unique: true })
    await ensureIndex(db.collection('receipts'), { organizationId: 1, customerId: 1, issuedAt: 1 })

    await ensureIndex(
      db.collection('credit_notes'),
      { organizationId: 1, documentNumber: 1 },
      { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('credit_notes'), { organizationId: 1, invoiceId: 1, status: 1 })
    await ensureIndex(db.collection('credit_notes'), { organizationId: 1, customerId: 1, documentDate: 1 })
    await ensureIndex(db.collection('credit_note_lines'), { creditNoteId: 1, sortOrder: 1 })

    await ensureIndex(
      db.collection('debit_notes'),
      { organizationId: 1, documentNumber: 1 },
      { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('debit_notes'), { organizationId: 1, customerId: 1, documentDate: 1 })
    await ensureIndex(db.collection('debit_notes'), { organizationId: 1, invoiceId: 1 })
    await ensureIndex(db.collection('debit_note_lines'), { debitNoteId: 1, sortOrder: 1 })

    await ensureIndex(db.collection('deposits'), { organizationId: 1, depositNumber: 1 }, { unique: true })
    await ensureIndex(db.collection('deposits'), { organizationId: 1, contractId: 1, status: 1 })
    await ensureIndex(db.collection('deposits'), { organizationId: 1, customerId: 1, heldAt: 1 })
    await ensureIndex(db.collection('deposits'), { organizationId: 1, branchId: 1, status: 1 })
    await ensureIndex(db.collection('deposit_events'), { depositId: 1, createdAt: 1 })

    await ensureIndex(db.collection('finance_status_events'), { entityType: 1, entityId: 1, createdAt: 1 })
    await ensureIndex(db.collection('finance_counters'), { organizationId: 1, name: 1 }, { unique: true })
    await ensureIndex(db.collection('finance_idempotency_keys'), { organizationId: 1, key: 1 }, { unique: true })
    await ensureIndex(
      db.collection('payment_webhook_events'),
      { organizationId: 1, provider: 1, externalEventId: 1 },
      { unique: true },
    )
  },
  async down({ db }) {
    const drop = async (name: string, indexes: string[]) => {
      const collection = db.collection(name)
      for (const index of indexes) await dropIndexIfExists(collection, index)
    }
    await drop('invoices', [
      'organizationId_1_documentNumber_1',
      'organizationId_1_branchId_1_status_1_documentDate_1',
      'organizationId_1_customerId_1_documentDate_1',
      'organizationId_1_contractId_1_documentDate_1',
      'organizationId_1_dueDate_1_status_1',
    ])
    await drop('invoice_lines', ['invoiceId_1_sortOrder_1', 'organizationId_1_sourceType_1_sourceId_1'])
    await drop('payments', [
      'organizationId_1_paymentNumber_1',
      'organizationId_1_externalReference_1',
      'organizationId_1_branchId_1_status_1_paymentDate_1',
      'organizationId_1_customerId_1_paymentDate_1',
    ])
    await drop('payment_allocations', ['paymentId_1_invoiceId_1', 'invoiceId_1_createdAt_1'])
    await drop('receipts', ['organizationId_1_receiptNumber_1', 'paymentId_1', 'organizationId_1_customerId_1_issuedAt_1'])
    await drop('credit_notes', [
      'organizationId_1_documentNumber_1',
      'organizationId_1_invoiceId_1_status_1',
      'organizationId_1_customerId_1_documentDate_1',
    ])
    await drop('credit_note_lines', ['creditNoteId_1_sortOrder_1'])
    await drop('debit_notes', [
      'organizationId_1_documentNumber_1',
      'organizationId_1_customerId_1_documentDate_1',
      'organizationId_1_invoiceId_1',
    ])
    await drop('debit_note_lines', ['debitNoteId_1_sortOrder_1'])
    await drop('deposits', [
      'organizationId_1_depositNumber_1',
      'organizationId_1_contractId_1_status_1',
      'organizationId_1_customerId_1_heldAt_1',
      'organizationId_1_branchId_1_status_1',
    ])
    await drop('deposit_events', ['depositId_1_createdAt_1'])
    await drop('finance_status_events', ['entityType_1_entityId_1_createdAt_1'])
    await drop('finance_counters', ['organizationId_1_name_1'])
    await drop('finance_idempotency_keys', ['organizationId_1_key_1'])
    await drop('payment_webhook_events', ['organizationId_1_provider_1_externalEventId_1'])
  },
}
