import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/** Module 11: chart of accounts, journals, fiscal periods, balances, mappings. */
export const migration010Accounting: MigrationDefinition = {
  id: '010_accounting',
  name: 'Create double-entry accounting indexes',
  async up({ db }) {
    await ensureIndex(db.collection('gl_accounts'), { organizationId: 1, code: 1 }, { unique: true })
    await ensureIndex(db.collection('gl_accounts'), { organizationId: 1, accountType: 1, isActive: 1 })
    await ensureIndex(
      db.collection('gl_accounts'),
      { organizationId: 1, systemRole: 1 },
      { unique: true, partialFilterExpression: { systemRole: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('gl_accounts'), { organizationId: 1, parentAccountId: 1 })

    await ensureIndex(db.collection('fiscal_years'), { organizationId: 1, legalEntityId: 1, name: 1 }, { unique: true })
    await ensureIndex(db.collection('fiscal_years'), { organizationId: 1, legalEntityId: 1, startDate: 1, endDate: 1 })

    await ensureIndex(db.collection('fiscal_periods'), { organizationId: 1, fiscalYearId: 1, periodNumber: 1 }, { unique: true })
    await ensureIndex(db.collection('fiscal_periods'), { organizationId: 1, legalEntityId: 1, startDate: 1, endDate: 1 })
    await ensureIndex(db.collection('fiscal_periods'), { organizationId: 1, legalEntityId: 1, status: 1 })

    await ensureIndex(
      db.collection('journal_entries'),
      { organizationId: 1, journalNumber: 1 },
      { unique: true, partialFilterExpression: { journalNumber: { $type: 'string' } } },
    )
    await ensureIndex(
      db.collection('journal_entries'),
      { organizationId: 1, sourceIdempotencyKey: 1 },
      { unique: true, partialFilterExpression: { sourceIdempotencyKey: { $type: 'string' } } },
    )
    await ensureIndex(db.collection('journal_entries'), { organizationId: 1, branchId: 1, status: 1, accountingDate: -1 })
    await ensureIndex(db.collection('journal_entries'), { organizationId: 1, legalEntityId: 1, accountingDate: -1 })
    await ensureIndex(db.collection('journal_entries'), { organizationId: 1, sourceModule: 1, sourceType: 1, sourceId: 1 })
    await ensureIndex(db.collection('journal_entries'), { organizationId: 1, fiscalPeriodId: 1, status: 1 })

    await ensureIndex(db.collection('journal_lines'), { journalId: 1, lineNumber: 1 }, { unique: true })
    await ensureIndex(db.collection('journal_lines'), { organizationId: 1, accountId: 1, journalId: 1 })
    await ensureIndex(db.collection('journal_lines'), { organizationId: 1, customerId: 1 })
    await ensureIndex(db.collection('journal_lines'), { organizationId: 1, vendorId: 1 })

    await ensureIndex(
      db.collection('account_balances'),
      { organizationId: 1, accountId: 1, fiscalPeriodId: 1, branchId: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('account_balances'), { organizationId: 1, fiscalPeriodId: 1 })

    await ensureIndex(db.collection('account_mappings'), { organizationId: 1, legalEntityId: 1, role: 1 }, { unique: true })
    await ensureIndex(db.collection('accounting_counters'), { organizationId: 1, name: 1 }, { unique: true })
    await ensureIndex(db.collection('accounting_status_events'), { entityType: 1, entityId: 1, createdAt: 1 })
  },
  async down({ db }) {
    const drop = (collection: string, names: string[]) =>
      Promise.all(names.map((name) => dropIndexIfExists(db.collection(collection), name)))
    await drop('gl_accounts', [
      'organizationId_1_code_1',
      'organizationId_1_accountType_1_isActive_1',
      'organizationId_1_systemRole_1',
      'organizationId_1_parentAccountId_1',
    ])
    await drop('fiscal_years', ['organizationId_1_legalEntityId_1_name_1', 'organizationId_1_legalEntityId_1_startDate_1_endDate_1'])
    await drop('fiscal_periods', [
      'organizationId_1_fiscalYearId_1_periodNumber_1',
      'organizationId_1_legalEntityId_1_startDate_1_endDate_1',
      'organizationId_1_legalEntityId_1_status_1',
    ])
    await drop('journal_entries', [
      'organizationId_1_journalNumber_1',
      'organizationId_1_sourceIdempotencyKey_1',
      'organizationId_1_branchId_1_status_1_accountingDate_-1',
      'organizationId_1_legalEntityId_1_accountingDate_-1',
      'organizationId_1_sourceModule_1_sourceType_1_sourceId_1',
      'organizationId_1_fiscalPeriodId_1_status_1',
    ])
    await drop('journal_lines', [
      'journalId_1_lineNumber_1',
      'organizationId_1_accountId_1_journalId_1',
      'organizationId_1_customerId_1',
      'organizationId_1_vendorId_1',
    ])
    await drop('account_balances', [
      'organizationId_1_accountId_1_fiscalPeriodId_1_branchId_1',
      'organizationId_1_fiscalPeriodId_1',
    ])
    await drop('account_mappings', ['organizationId_1_legalEntityId_1_role_1'])
    await drop('accounting_counters', ['organizationId_1_name_1'])
    await drop('accounting_status_events', ['entityType_1_entityId_1_createdAt_1'])
  },
}
