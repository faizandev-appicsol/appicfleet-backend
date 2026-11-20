import {
  ACCOUNT_ROLES,
  JOURNAL_TYPES,
  SOURCE_MODULES,
  type AccountRole,
} from '../../constants/accounting.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { findMappedAccountId } from '../../repositories/accounting/accounting.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict } from '../../utils/httpErrors.js'
import { addMoney, normalizeMoney } from '../../utils/money.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { createJournalDraft, postJournal, type JournalLineBody } from '../accounting/posting.service.js'

async function requireMapped(
  organizationId: string,
  legalEntityId: string,
  role: AccountRole,
): Promise<string> {
  const accountId = await findMappedAccountId(organizationId, legalEntityId, role)
  if (!accountId) {
    throw conflict(`Account mapping for role ${role.toLowerCase()} is not configured.`)
  }
  return accountId
}

/**
 * Posts payroll accrual journal via Module 11 accounting engine.
 * Dr Salary Expense (+ employer contribution expense)
 *    Cr Payroll Payable
 */
export async function postPayrollAccrual(
  ctx: AccessContext,
  input: {
    organizationId: string
    legalEntityId: string
    branchId: string
    payrollRunId: string
    accountingDate: Date
    grossTotal: string
    employerCostTotal: string
    currency: string
    description: string
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_POST)
  const salaryExpense = await requireMapped(
    input.organizationId,
    input.legalEntityId,
    ACCOUNT_ROLES.SALARY_EXPENSE,
  )
  const payable = await requireMapped(
    input.organizationId,
    input.legalEntityId,
    ACCOUNT_ROLES.PAYROLL_PAYABLE,
  )
  const gross = normalizeMoney(input.grossTotal)
  const employer = normalizeMoney(input.employerCostTotal)
  const lines: JournalLineBody[] = [
    { accountId: salaryExpense, debit: gross, credit: '0.00' },
  ]
  let creditTotal = gross
  if (employer !== '0.00') {
    const employerExpense = await requireMapped(
      input.organizationId,
      input.legalEntityId,
      ACCOUNT_ROLES.EMPLOYER_CONTRIBUTION_EXPENSE,
    )
    lines.push({ accountId: employerExpense, debit: employer, credit: '0.00' })
    creditTotal = addMoney(gross, employer)
  }
  lines.push({ accountId: payable, debit: '0.00', credit: creditTotal })

  const draft = await createJournalDraft(
    ctx,
    {
      organizationId: input.organizationId,
      legalEntityId: input.legalEntityId,
      branchId: input.branchId,
      journalType: JOURNAL_TYPES.SYSTEM,
      accountingDate: input.accountingDate,
      description: input.description,
      currency: input.currency,
      sourceModule: SOURCE_MODULES.PAYROLL,
      sourceType: 'PAYROLL_ACCRUAL',
      sourceId: input.payrollRunId,
      sourceIdempotencyKey: `payroll:accrual:${input.payrollRunId}`,
      lines,
    },
    meta,
  )
  return postJournal(ctx, draft.id, meta)
}

/**
 * Posts payroll payment clearing journal.
 * Dr Payroll Payable
 *    Cr Bank/Cash
 */
export async function postPayrollPaymentClearing(
  ctx: AccessContext,
  input: {
    organizationId: string
    legalEntityId: string
    branchId: string
    payrollRunId: string
    accountingDate: Date
    netTotal: string
    currency: string
    description: string
    useBank?: boolean
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_POST)
  const payable = await requireMapped(
    input.organizationId,
    input.legalEntityId,
    ACCOUNT_ROLES.PAYROLL_PAYABLE,
  )
  const cashOrBank = await requireMapped(
    input.organizationId,
    input.legalEntityId,
    input.useBank === false ? ACCOUNT_ROLES.CASH : ACCOUNT_ROLES.BANK,
  )
  const amount = normalizeMoney(input.netTotal)
  const lines: JournalLineBody[] = [
    { accountId: payable, debit: amount, credit: '0.00' },
    { accountId: cashOrBank, debit: '0.00', credit: amount },
  ]

  const draft = await createJournalDraft(
    ctx,
    {
      organizationId: input.organizationId,
      legalEntityId: input.legalEntityId,
      branchId: input.branchId,
      journalType: JOURNAL_TYPES.PAYMENT,
      accountingDate: input.accountingDate,
      description: input.description,
      currency: input.currency,
      sourceModule: SOURCE_MODULES.PAYROLL,
      sourceType: 'PAYROLL_PAYMENT',
      sourceId: input.payrollRunId,
      sourceIdempotencyKey: `payroll:payment:${input.payrollRunId}`,
      lines,
    },
    meta,
  )
  return postJournal(ctx, draft.id, meta)
}
