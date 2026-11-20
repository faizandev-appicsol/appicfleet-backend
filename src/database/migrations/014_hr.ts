import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/** Module 16: HR employees, departments, positions, documents, history. */
export const migration014Hr: MigrationDefinition = {
  id: '014_hr',
  name: 'Create HR employee management indexes',
  async up({ db }) {
    await ensureIndex(db.collection('employees'), { organizationId: 1, employeeNumber: 1 }, { unique: true })
    await ensureIndex(db.collection('employees'), { organizationId: 1, status: 1, lastName: 1, firstName: 1 })
    await ensureIndex(db.collection('employees'), { organizationId: 1, branchId: 1, status: 1 })
    await ensureIndex(db.collection('employees'), { organizationId: 1, legalEntityId: 1 })
    await ensureIndex(db.collection('employees'), { organizationId: 1, departmentId: 1 })
    await ensureIndex(db.collection('employees'), { organizationId: 1, positionId: 1 })
    await ensureIndex(db.collection('employees'), { organizationId: 1, managerEmployeeId: 1 })
    await ensureIndex(db.collection('employees'), { organizationId: 1, userId: 1 }, { unique: true, sparse: true })
    await ensureIndex(db.collection('employees'), { organizationId: 1, workEmail: 1 })
    await ensureIndex(db.collection('employees'), { organizationId: 1, hireDate: 1 })

    await ensureIndex(
      db.collection('hr_departments'),
      { organizationId: 1, legalEntityId: 1, code: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('hr_departments'), { organizationId: 1, status: 1, name: 1 })

    await ensureIndex(
      db.collection('hr_positions'),
      { organizationId: 1, legalEntityId: 1, code: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('hr_positions'), { organizationId: 1, departmentId: 1, status: 1 })

    await ensureIndex(db.collection('hr_employee_documents'), {
      organizationId: 1,
      employeeId: 1,
      createdAt: -1,
    })
    await ensureIndex(db.collection('hr_employee_documents'), {
      organizationId: 1,
      expiresOn: 1,
      status: 1,
    })

    await ensureIndex(db.collection('hr_employee_history'), {
      organizationId: 1,
      employeeId: 1,
      createdAt: -1,
    })

    await ensureIndex(db.collection('hr_notification_intents'), { intentKey: 1 }, { unique: true })
    await ensureIndex(db.collection('hr_counters'), { organizationId: 1, name: 1 }, { unique: true })
  },
  async down({ db }) {
    const drop = (collection: string, names: string[]) =>
      Promise.all(names.map((name) => dropIndexIfExists(db.collection(collection), name)))
    await drop('employees', [
      'organizationId_1_employeeNumber_1',
      'organizationId_1_status_1_lastName_1_firstName_1',
      'organizationId_1_branchId_1_status_1',
      'organizationId_1_legalEntityId_1',
      'organizationId_1_departmentId_1',
      'organizationId_1_positionId_1',
      'organizationId_1_managerEmployeeId_1',
      'organizationId_1_userId_1',
      'organizationId_1_workEmail_1',
      'organizationId_1_hireDate_1',
    ])
    await drop('hr_departments', [
      'organizationId_1_legalEntityId_1_code_1',
      'organizationId_1_status_1_name_1',
    ])
    await drop('hr_positions', [
      'organizationId_1_legalEntityId_1_code_1',
      'organizationId_1_departmentId_1_status_1',
    ])
    await drop('hr_employee_documents', [
      'organizationId_1_employeeId_1_createdAt_-1',
      'organizationId_1_expiresOn_1_status_1',
    ])
    await drop('hr_employee_history', ['organizationId_1_employeeId_1_createdAt_-1'])
    await drop('hr_notification_intents', ['intentKey_1'])
    await drop('hr_counters', ['organizationId_1_name_1'])
  },
}
