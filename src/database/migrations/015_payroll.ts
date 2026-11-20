import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/** Module 17: Payroll & Compensation indexes. */
export const migration015Payroll: MigrationDefinition = {
  id: '015_payroll',
  name: 'Create payroll and compensation indexes',
  async up({ db }) {
    await ensureIndex(db.collection('salary_components'), { organizationId: 1, code: 1 }, { unique: true })
    await ensureIndex(db.collection('salary_components'), {
      organizationId: 1,
      status: 1,
      componentType: 1,
    })

    await ensureIndex(
      db.collection('compensation_structures'),
      { organizationId: 1, code: 1 },
      { unique: true },
    )

    await ensureIndex(db.collection('employee_compensation_assignments'), {
      organizationId: 1,
      employeeId: 1,
      effectiveFrom: -1,
    })
    await ensureIndex(db.collection('employee_compensation_assignments'), {
      organizationId: 1,
      employeeId: 1,
      status: 1,
      isPrimary: 1,
    })

    await ensureIndex(db.collection('compensation_history'), {
      organizationId: 1,
      employeeId: 1,
      createdAt: -1,
    })

    await ensureIndex(
      db.collection('payroll_periods'),
      { organizationId: 1, legalEntityId: 1, frequency: 1, periodNumber: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('payroll_periods'), {
      organizationId: 1,
      legalEntityId: 1,
      startDate: 1,
      endDate: 1,
    })
    await ensureIndex(db.collection('payroll_periods'), { organizationId: 1, status: 1 })

    await ensureIndex(db.collection('payroll_runs'), { organizationId: 1, runNumber: 1 }, { unique: true })
    await ensureIndex(db.collection('payroll_runs'), {
      organizationId: 1,
      payrollPeriodId: 1,
      createdAt: -1,
    })
    await ensureIndex(db.collection('payroll_runs'), { organizationId: 1, status: 1 })

    await ensureIndex(
      db.collection('payroll_calculations'),
      { organizationId: 1, payrollRunId: 1, employeeId: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('payroll_calculations'), {
      organizationId: 1,
      payrollPeriodId: 1,
      employeeId: 1,
    })

    await ensureIndex(db.collection('payroll_bonuses'), {
      organizationId: 1,
      employeeId: 1,
      status: 1,
      effectiveDate: 1,
    })
    await ensureIndex(db.collection('payroll_bonuses'), {
      organizationId: 1,
      payrollPeriodId: 1,
      status: 1,
    })

    await ensureIndex(db.collection('payroll_deductions'), {
      organizationId: 1,
      employeeId: 1,
      status: 1,
      effectiveDate: 1,
    })
    await ensureIndex(db.collection('payroll_deductions'), {
      organizationId: 1,
      payrollPeriodId: 1,
      status: 1,
    })

    await ensureIndex(db.collection('payroll_adjustments'), {
      organizationId: 1,
      payrollPeriodId: 1,
      status: 1,
    })
    await ensureIndex(db.collection('payroll_adjustments'), {
      organizationId: 1,
      employeeId: 1,
      status: 1,
    })

    await ensureIndex(db.collection('payroll_overtime'), {
      organizationId: 1,
      employeeId: 1,
      workDate: 1,
    })
    await ensureIndex(db.collection('payroll_overtime'), {
      organizationId: 1,
      payrollPeriodId: 1,
      status: 1,
    })

    await ensureIndex(db.collection('employee_advances'), {
      organizationId: 1,
      employeeId: 1,
      status: 1,
    })

    await ensureIndex(db.collection('payslips'), { organizationId: 1, payslipNumber: 1 }, { unique: true })
    await ensureIndex(
      db.collection('payslips'),
      { organizationId: 1, payrollRunId: 1, employeeId: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('payslips'), { organizationId: 1, employeeId: 1, payDate: -1 })

    await ensureIndex(
      db.collection('payroll_payments'),
      { organizationId: 1, idempotencyKey: 1 },
      { unique: true },
    )
    await ensureIndex(
      db.collection('payroll_payments'),
      { organizationId: 1, payrollRunId: 1, employeeId: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('payroll_payments'), {
      organizationId: 1,
      status: 1,
      paymentDate: -1,
    })

    await ensureIndex(db.collection('payroll_approvals'), {
      organizationId: 1,
      payrollRunId: 1,
      createdAt: -1,
    })

    await ensureIndex(db.collection('payroll_notification_intents'), { intentKey: 1 }, { unique: true })
    await ensureIndex(db.collection('payroll_counters'), { organizationId: 1, name: 1 }, { unique: true })
  },
  async down({ db }) {
    const drop = (collection: string, names: string[]) =>
      Promise.all(names.map((name) => dropIndexIfExists(db.collection(collection), name)))

    await drop('salary_components', [
      'organizationId_1_code_1',
      'organizationId_1_status_1_componentType_1',
    ])
    await drop('compensation_structures', ['organizationId_1_code_1'])
    await drop('employee_compensation_assignments', [
      'organizationId_1_employeeId_1_effectiveFrom_-1',
      'organizationId_1_employeeId_1_status_1_isPrimary_1',
    ])
    await drop('compensation_history', ['organizationId_1_employeeId_1_createdAt_-1'])
    await drop('payroll_periods', [
      'organizationId_1_legalEntityId_1_frequency_1_periodNumber_1',
      'organizationId_1_legalEntityId_1_startDate_1_endDate_1',
      'organizationId_1_status_1',
    ])
    await drop('payroll_runs', [
      'organizationId_1_runNumber_1',
      'organizationId_1_payrollPeriodId_1_createdAt_-1',
      'organizationId_1_status_1',
    ])
    await drop('payroll_calculations', [
      'organizationId_1_payrollRunId_1_employeeId_1',
      'organizationId_1_payrollPeriodId_1_employeeId_1',
    ])
    await drop('payroll_bonuses', [
      'organizationId_1_employeeId_1_status_1_effectiveDate_1',
      'organizationId_1_payrollPeriodId_1_status_1',
    ])
    await drop('payroll_deductions', [
      'organizationId_1_employeeId_1_status_1_effectiveDate_1',
      'organizationId_1_payrollPeriodId_1_status_1',
    ])
    await drop('payroll_adjustments', [
      'organizationId_1_payrollPeriodId_1_status_1',
      'organizationId_1_employeeId_1_status_1',
    ])
    await drop('payroll_overtime', [
      'organizationId_1_employeeId_1_workDate_1',
      'organizationId_1_payrollPeriodId_1_status_1',
    ])
    await drop('employee_advances', ['organizationId_1_employeeId_1_status_1'])
    await drop('payslips', [
      'organizationId_1_payslipNumber_1',
      'organizationId_1_payrollRunId_1_employeeId_1',
      'organizationId_1_employeeId_1_payDate_-1',
    ])
    await drop('payroll_payments', [
      'organizationId_1_idempotencyKey_1',
      'organizationId_1_payrollRunId_1_employeeId_1',
      'organizationId_1_status_1_paymentDate_-1',
    ])
    await drop('payroll_approvals', ['organizationId_1_payrollRunId_1_createdAt_-1'])
    await drop('payroll_notification_intents', ['intentKey_1'])
    await drop('payroll_counters', ['organizationId_1_name_1'])
  },
}
