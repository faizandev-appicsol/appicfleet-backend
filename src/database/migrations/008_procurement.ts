import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/** Module 9: vendors, LPOs, vendor bills, expenses, service. Accounting journals are out of scope. */
export const migration008Procurement: MigrationDefinition = {
  id: '008_procurement',
  name: 'Create procurement and service indexes',
  async up({ db }) {
    await ensureIndex(db.collection('vendors'), { organizationId: 1, vendorCode: 1 }, { unique: true })
    await ensureIndex(db.collection('vendors'), { organizationId: 1, branchId: 1, status: 1, name: 1 })
    await ensureIndex(db.collection('vendors'), { organizationId: 1, vendorType: 1, status: 1 })
    await ensureIndex(db.collection('vendors'), { organizationId: 1, name: 1 })
    await ensureIndex(db.collection('vendor_contacts'), { vendorId: 1, role: 1, name: 1 })
    await ensureIndex(db.collection('vendor_documents'), { vendorId: 1, createdAt: 1 })

    await ensureIndex(
      db.collection('lpos'),
      { organizationId: 1, documentNumber: 1 },
      { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('lpos'), { organizationId: 1, vendorId: 1, orderDate: 1 })
    await ensureIndex(db.collection('lpos'), { organizationId: 1, branchId: 1, status: 1, orderDate: 1 })
    await ensureIndex(db.collection('lpo_lines'), { lpoId: 1, sortOrder: 1 })

    await ensureIndex(
      db.collection('vendor_bills'),
      { organizationId: 1, documentNumber: 1 },
      { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('vendor_bills'), { organizationId: 1, vendorId: 1, vendorInvoiceNumber: 1 }, { unique: true })
    await ensureIndex(db.collection('vendor_bills'), { organizationId: 1, lpoId: 1, status: 1 })
    await ensureIndex(db.collection('vendor_bills'), { organizationId: 1, branchId: 1, status: 1, billDate: 1 })
    await ensureIndex(db.collection('vendor_bill_lines'), { vendorBillId: 1, sortOrder: 1 })

    await ensureIndex(db.collection('expense_categories'), { organizationId: 1, code: 1 }, { unique: true })
    await ensureIndex(
      db.collection('expenses'),
      { organizationId: 1, documentNumber: 1 },
      { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('expenses'), { organizationId: 1, branchId: 1, status: 1, expenseDate: 1 })
    await ensureIndex(db.collection('expenses'), { organizationId: 1, vehicleId: 1, expenseDate: 1 })
    await ensureIndex(db.collection('expenses'), { organizationId: 1, categoryCode: 1, expenseDate: 1 })

    await ensureIndex(
      db.collection('work_orders'),
      { organizationId: 1, documentNumber: 1 },
      { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('work_orders'), { organizationId: 1, vehicleId: 1, status: 1, scheduledAt: 1 })
    await ensureIndex(db.collection('work_orders'), { organizationId: 1, vendorId: 1, status: 1 })
    await ensureIndex(db.collection('work_orders'), { organizationId: 1, branchId: 1, status: 1 })
    await ensureIndex(db.collection('work_order_lines'), { workOrderId: 1, sortOrder: 1 })

    await ensureIndex(db.collection('service_reminders'), { organizationId: 1, vehicleId: 1, status: 1, dueAt: 1 })
    await ensureIndex(db.collection('service_reminders'), { organizationId: 1, status: 1, dueAt: 1 })
    await ensureIndex(db.collection('borrow_cost_terms'), { organizationId: 1, vehicleId: 1, effectiveFrom: 1 })

    await ensureIndex(
      db.collection('ap_payments'),
      { organizationId: 1, paymentNumber: 1 },
      { unique: true, partialFilterExpression: { paymentNumber: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('ap_payments'), { organizationId: 1, vendorId: 1, paymentDate: 1 })
    await ensureIndex(db.collection('ap_payment_allocations'), { apPaymentId: 1, vendorBillId: 1 }, { unique: true })
    await ensureIndex(db.collection('ap_payment_allocations'), { vendorBillId: 1, createdAt: 1 })

    await ensureIndex(db.collection('procurement_counters'), { organizationId: 1, name: 1 }, { unique: true })
    await ensureIndex(db.collection('procurement_status_events'), { entityType: 1, entityId: 1, createdAt: 1 })
    await ensureIndex(db.collection('accounting_source_events'), { organizationId: 1, idempotencyKey: 1 }, { unique: true })
    await ensureIndex(db.collection('accounting_source_events'), { organizationId: 1, eventType: 1, createdAt: 1 })
  },
  async down({ db }) {
    const drop = async (name: string, indexes: string[]) => {
      const collection = db.collection(name)
      for (const index of indexes) await dropIndexIfExists(collection, index)
    }
    await drop('vendors', [
      'organizationId_1_vendorCode_1',
      'organizationId_1_branchId_1_status_1_name_1',
      'organizationId_1_vendorType_1_status_1',
      'organizationId_1_name_1',
    ])
    await drop('vendor_contacts', ['vendorId_1_role_1_name_1'])
    await drop('vendor_documents', ['vendorId_1_createdAt_1'])
    await drop('lpos', [
      'organizationId_1_documentNumber_1',
      'organizationId_1_vendorId_1_orderDate_1',
      'organizationId_1_branchId_1_status_1_orderDate_1',
    ])
    await drop('lpo_lines', ['lpoId_1_sortOrder_1'])
    await drop('vendor_bills', [
      'organizationId_1_documentNumber_1',
      'organizationId_1_vendorId_1_vendorInvoiceNumber_1',
      'organizationId_1_lpoId_1_status_1',
      'organizationId_1_branchId_1_status_1_billDate_1',
    ])
    await drop('vendor_bill_lines', ['vendorBillId_1_sortOrder_1'])
    await drop('expense_categories', ['organizationId_1_code_1'])
    await drop('expenses', [
      'organizationId_1_documentNumber_1',
      'organizationId_1_branchId_1_status_1_expenseDate_1',
      'organizationId_1_vehicleId_1_expenseDate_1',
      'organizationId_1_categoryCode_1_expenseDate_1',
    ])
    await drop('work_orders', [
      'organizationId_1_documentNumber_1',
      'organizationId_1_vehicleId_1_status_1_scheduledAt_1',
      'organizationId_1_vendorId_1_status_1',
      'organizationId_1_branchId_1_status_1',
    ])
    await drop('work_order_lines', ['workOrderId_1_sortOrder_1'])
    await drop('service_reminders', ['organizationId_1_vehicleId_1_status_1_dueAt_1', 'organizationId_1_status_1_dueAt_1'])
    await drop('borrow_cost_terms', ['organizationId_1_vehicleId_1_effectiveFrom_1'])
    await drop('ap_payments', ['organizationId_1_paymentNumber_1', 'organizationId_1_vendorId_1_paymentDate_1'])
    await drop('ap_payment_allocations', ['apPaymentId_1_vendorBillId_1', 'vendorBillId_1_createdAt_1'])
    await drop('procurement_counters', ['organizationId_1_name_1'])
    await drop('procurement_status_events', ['entityType_1_entityId_1_createdAt_1'])
    await drop('accounting_source_events', ['organizationId_1_idempotencyKey_1', 'organizationId_1_eventType_1_createdAt_1'])
  },
}
