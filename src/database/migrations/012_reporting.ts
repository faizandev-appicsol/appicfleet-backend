import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/** Module 13: supporting indexes for dashboard/report aggregations. */
export const migration012Reporting: MigrationDefinition = {
  id: '012_reporting',
  name: 'Create reporting support indexes',
  async up({ db }) {
    await ensureIndex(db.collection('invoices'), {
      organizationId: 1,
      status: 1,
      documentDate: 1,
      legalEntityId: 1,
      branchId: 1,
    })
    await ensureIndex(db.collection('invoices'), {
      organizationId: 1,
      status: 1,
      outstandingAmount: 1,
      dueDate: 1,
    })
    await ensureIndex(db.collection('payments'), {
      organizationId: 1,
      status: 1,
      paymentDate: 1,
      branchId: 1,
    })
    await ensureIndex(db.collection('bookings'), {
      organizationId: 1,
      createdAt: 1,
      status: 1,
      branchId: 1,
    })
    await ensureIndex(db.collection('contracts'), {
      organizationId: 1,
      status: 1,
      endsAt: 1,
      branchId: 1,
    })
    await ensureIndex(db.collection('vehicles'), {
      organizationId: 1,
      status: 1,
      branchId: 1,
      category: 1,
    })
    await ensureIndex(db.collection('vehicle_assignments'), {
      organizationId: 1,
      vehicleId: 1,
      startsAt: 1,
      endsAt: 1,
      status: 1,
    })
    await ensureIndex(db.collection('expenses'), {
      organizationId: 1,
      expenseDate: 1,
      status: 1,
      branchId: 1,
    })
    await ensureIndex(db.collection('work_orders'), {
      organizationId: 1,
      scheduledAt: 1,
      status: 1,
      branchId: 1,
    })
    await ensureIndex(db.collection('customers'), {
      organizationId: 1,
      createdAt: 1,
      branchId: 1,
    })
  },
  async down({ db }) {
    const drop = (collection: string, names: string[]) =>
      Promise.all(names.map((name) => dropIndexIfExists(db.collection(collection), name)))
    await drop('invoices', [
      'organizationId_1_status_1_documentDate_1_legalEntityId_1_branchId_1',
      'organizationId_1_status_1_outstandingAmount_1_dueDate_1',
    ])
    await drop('payments', ['organizationId_1_status_1_paymentDate_1_branchId_1'])
    await drop('bookings', ['organizationId_1_createdAt_1_status_1_branchId_1'])
    await drop('contracts', ['organizationId_1_status_1_endsAt_1_branchId_1'])
    await drop('vehicles', ['organizationId_1_status_1_branchId_1_category_1'])
    await drop('vehicle_assignments', ['organizationId_1_vehicleId_1_startsAt_1_endsAt_1_status_1'])
    await drop('expenses', ['organizationId_1_expenseDate_1_status_1_branchId_1'])
    await drop('work_orders', ['organizationId_1_scheduledAt_1_status_1_branchId_1'])
    await drop('customers', ['organizationId_1_createdAt_1_branchId_1'])
  },
}
