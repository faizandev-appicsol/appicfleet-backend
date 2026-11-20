import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/** Module 18: Attendance, Leave & Workforce Scheduling indexes. */
export const migration016Workforce: MigrationDefinition = {
  id: '016_workforce',
  name: 'Create attendance, leave and workforce indexes',
  async up({ db }) {
    await ensureIndex(db.collection('work_schedules'), { organizationId: 1, code: 1 }, { unique: true })
    await ensureIndex(db.collection('work_schedules'), { organizationId: 1, status: 1 })

    await ensureIndex(
      db.collection('shift_definitions'),
      { organizationId: 1, code: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('shift_definitions'), { organizationId: 1, status: 1 })

    await ensureIndex(db.collection('employee_schedule_assignments'), {
      organizationId: 1,
      employeeId: 1,
      effectiveFrom: -1,
    })
    await ensureIndex(db.collection('employee_schedule_assignments'), {
      organizationId: 1,
      employeeId: 1,
      status: 1,
    })
    await ensureIndex(db.collection('employee_schedule_assignments'), {
      organizationId: 1,
      branchId: 1,
      status: 1,
    })

    await ensureIndex(db.collection('schedule_history'), {
      organizationId: 1,
      employeeId: 1,
      createdAt: -1,
    })

    await ensureIndex(
      db.collection('attendance_records'),
      { organizationId: 1, employeeId: 1, businessDate: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('attendance_records'), {
      organizationId: 1,
      branchId: 1,
      businessDate: 1,
      status: 1,
    })
    await ensureIndex(db.collection('attendance_records'), {
      organizationId: 1,
      status: 1,
      businessDate: 1,
    })
    await ensureIndex(
      db.collection('attendance_records'),
      { organizationId: 1, externalReference: 1 },
      { unique: true, sparse: true },
    )

    await ensureIndex(db.collection('attendance_corrections'), {
      organizationId: 1,
      status: 1,
      createdAt: -1,
    })
    await ensureIndex(db.collection('attendance_corrections'), {
      organizationId: 1,
      attendanceRecordId: 1,
      createdAt: -1,
    })

    await ensureIndex(db.collection('attendance_exceptions'), {
      organizationId: 1,
      resolved: 1,
      businessDate: -1,
    })
    await ensureIndex(db.collection('attendance_exceptions'), {
      organizationId: 1,
      employeeId: 1,
      code: 1,
      businessDate: 1,
    })

    await ensureIndex(db.collection('leave_types'), { organizationId: 1, code: 1 }, { unique: true })

    await ensureIndex(db.collection('leave_policies'), {
      organizationId: 1,
      leaveTypeId: 1,
      effectiveFrom: -1,
    })
    await ensureIndex(db.collection('leave_policies'), { organizationId: 1, status: 1 })

    await ensureIndex(
      db.collection('employee_leave_balances'),
      { organizationId: 1, employeeId: 1, leaveTypeId: 1, periodYear: 1 },
      { unique: true },
    )

    await ensureIndex(
      db.collection('leave_balance_transactions'),
      { organizationId: 1, idempotencyKey: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('leave_balance_transactions'), {
      organizationId: 1,
      leaveBalanceId: 1,
      createdAt: -1,
    })

    await ensureIndex(db.collection('leave_requests'), {
      organizationId: 1,
      employeeId: 1,
      status: 1,
      startDate: -1,
    })
    await ensureIndex(db.collection('leave_requests'), {
      organizationId: 1,
      status: 1,
      startDate: 1,
      endDate: 1,
    })
    await ensureIndex(
      db.collection('leave_requests'),
      { organizationId: 1, idempotencyKey: 1 },
      { unique: true, sparse: true },
    )

    await ensureIndex(db.collection('leave_approvals'), {
      organizationId: 1,
      leaveRequestId: 1,
      createdAt: -1,
    })

    await ensureIndex(db.collection('holidays'), { organizationId: 1, date: 1, branchId: 1 })
    await ensureIndex(db.collection('holidays'), { organizationId: 1, status: 1, date: 1 })

    await ensureIndex(db.collection('attendance_overtime'), {
      organizationId: 1,
      employeeId: 1,
      workDate: 1,
    })
    await ensureIndex(db.collection('attendance_overtime'), {
      organizationId: 1,
      status: 1,
      workDate: 1,
    })

    await ensureIndex(
      db.collection('attendance_import_batches'),
      { organizationId: 1, externalBatchId: 1 },
      { unique: true },
    )

    await ensureIndex(
      db.collection('workforce_notification_intents'),
      { organizationId: 1, intentKey: 1 },
      { unique: true },
    )
    await ensureIndex(
      db.collection('workforce_outbox_events'),
      { organizationId: 1, eventKey: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('workforce_outbox_events'), {
      organizationId: 1,
      eventType: 1,
      createdAt: -1,
    })
  },
  async down({ db }) {
    await dropIndexIfExists(db.collection('work_schedules'), 'organizationId_1_code_1')
    await dropIndexIfExists(db.collection('shift_definitions'), 'organizationId_1_code_1')
    await dropIndexIfExists(
      db.collection('attendance_records'),
      'organizationId_1_employeeId_1_businessDate_1',
    )
    await dropIndexIfExists(db.collection('leave_types'), 'organizationId_1_code_1')
    await dropIndexIfExists(
      db.collection('employee_leave_balances'),
      'organizationId_1_employeeId_1_leaveTypeId_1_periodYear_1',
    )
    await dropIndexIfExists(
      db.collection('leave_balance_transactions'),
      'organizationId_1_idempotencyKey_1',
    )
    await dropIndexIfExists(
      db.collection('workforce_notification_intents'),
      'organizationId_1_intentKey_1',
    )
    await dropIndexIfExists(db.collection('workforce_outbox_events'), 'organizationId_1_eventKey_1')
  },
}
