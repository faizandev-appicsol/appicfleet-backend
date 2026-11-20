import { NORMAL_BALANCES, type AccountType } from '../../constants/accounting.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import {
  listAllAccounts,
  listLedgerLines,
  listPeriodBalances,
} from '../../repositories/accounting/accounting.repository.js'
import type { AccessContext } from '../../types/access.js'
import { addMoney, compareMoney, normalizeMoney, subtractMoney } from '../../utils/money.js'
import { invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { addSignedMoney, signedMovement } from './accounting-rules.js'
import { loadAccessibleAccount, loadAccessiblePeriod, resolveAccountingOrganization } from './accounting-access.js'

export async function getGeneralLedger(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_VIEW_LEDGER)
  const organizationId = resolveAccountingOrganization(ctx, query.organizationId as string | undefined)
  const accountId = String(query.accountId ?? '')
  if (!accountId) throw invalidField('accountId', 'accountId is required.')
  const account = await loadAccessibleAccount(ctx, accountId)
  if (account.organizationId !== organizationId) throw notFound('Account was not found.')

  const pagination = resolvePagination(query)
  const page = await listLedgerLines({
    organizationId,
    accountId,
    from: query.from as Date | undefined,
    to: query.to as Date | undefined,
    branchId: query.branchId as string | undefined,
    legalEntityId: query.legalEntityId as string | undefined,
    customerId: query.customerId as string | undefined,
    vendorId: query.vendorId as string | undefined,
    skip: pagination.skip,
    take: pagination.take,
  })

  let running = '0.00'
  const items = page.items.map((row) => {
    const movement = signedMovement(
      account.normalBalance as 'DEBIT' | 'CREDIT',
      row.debit,
      row.credit,
    )
    running = addSignedMoney(running, movement)
    return {
      id: row.id,
      accountingDate: row.accountingDate?.toISOString(),
      journalId: row.journalId,
      journalNumber: row.journalNumber,
      reference: row.journalReference ?? row.reference,
      description: row.description ?? row.journalDescription,
      debit: row.debit,
      credit: row.credit,
      runningBalance: running,
      customerId: row.customerId,
      vendorId: row.vendorId,
      status: row.journalStatus ? toPublicEnum(row.journalStatus) : undefined,
    }
  })

  return {
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      normalBalance: toPublicEnum(account.normalBalance),
    },
    ...toPaginated(items, pagination.page, pagination.limit, page.total),
  }
}

export async function getTrialBalance(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_VIEW_TRIAL_BALANCE)
  const organizationId = resolveAccountingOrganization(ctx, query.organizationId as string | undefined)
  const fiscalPeriodId = String(query.fiscalPeriodId ?? '')
  if (!fiscalPeriodId) throw invalidField('fiscalPeriodId', 'fiscalPeriodId is required.')
  const period = await loadAccessiblePeriod(ctx, fiscalPeriodId)
  if (period.organizationId !== organizationId) throw notFound('Fiscal period was not found.')

  const balances = await listPeriodBalances(organizationId, fiscalPeriodId, period.legalEntityId)
  const accounts = await listAllAccounts(organizationId)
  const accountMap = new Map(accounts.map((row) => [row.id, row]))

  const aggregated = new Map<string, { debit: string; credit: string }>()
  for (const row of balances) {
    const accountId = String(row.accountId)
    const current = aggregated.get(accountId) ?? { debit: '0.00', credit: '0.00' }
    aggregated.set(accountId, {
      debit: addMoney(current.debit, normalizeMoney(String(row.periodDebit))),
      credit: addMoney(current.credit, normalizeMoney(String(row.periodCredit))),
    })
  }

  const rows = [...aggregated.entries()]
    .map(([accountId, totals]) => {
      const account = accountMap.get(accountId)
      if (!account) return null
      const normal = account.normalBalance
      let debitBalance = '0.00'
      let creditBalance = '0.00'
      if (normal === NORMAL_BALANCES.DEBIT) {
        if (compareMoney(totals.debit, totals.credit) >= 0) {
          debitBalance = subtractMoney(totals.debit, totals.credit)
        } else {
          creditBalance = subtractMoney(totals.credit, totals.debit)
        }
      } else if (compareMoney(totals.credit, totals.debit) >= 0) {
        creditBalance = subtractMoney(totals.credit, totals.debit)
      } else {
        debitBalance = subtractMoney(totals.debit, totals.credit)
      }
      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: toPublicEnum(account.accountType as AccountType),
        debitBalance,
        creditBalance,
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode))

  const totalDebit = rows.reduce((sum, row) => addMoney(sum, row.debitBalance), '0.00')
  const totalCredit = rows.reduce((sum, row) => addMoney(sum, row.creditBalance), '0.00')
  const difference =
    compareMoney(totalDebit, totalCredit) >= 0
      ? subtractMoney(totalDebit, totalCredit)
      : subtractMoney(totalCredit, totalDebit)

  return {
    fiscalPeriodId: period.id,
    periodName: period.name,
    rows,
    totalDebit,
    totalCredit,
    difference,
    balanced: compareMoney(totalDebit, totalCredit) === 0,
  }
}

export async function getAccountBalanceSummary(
  ctx: AccessContext,
  accountId: string,
  query: Record<string, unknown>,
) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_VIEW_LEDGER)
  const account = await loadAccessibleAccount(ctx, accountId)
  const fiscalPeriodId = query.fiscalPeriodId ? String(query.fiscalPeriodId) : undefined
  if (!fiscalPeriodId) {
    return {
      accountId: account.id,
      openingBalance: '0.00',
      periodDebit: '0.00',
      periodCredit: '0.00',
      closingBalance: '0.00',
    }
  }
  const period = await loadAccessiblePeriod(ctx, fiscalPeriodId)
  const balances = await listPeriodBalances(account.organizationId, period.id, period.legalEntityId)
  const mine = balances.filter((row) => String(row.accountId) === account.id)
  const periodDebit = mine.reduce((sum, row) => addMoney(sum, normalizeMoney(String(row.periodDebit))), '0.00')
  const periodCredit = mine.reduce((sum, row) => addMoney(sum, normalizeMoney(String(row.periodCredit))), '0.00')
  const movement = signedMovement(account.normalBalance as 'DEBIT' | 'CREDIT', periodDebit, periodCredit)
  return {
    accountId: account.id,
    fiscalPeriodId: period.id,
    openingBalance: '0.00',
    periodDebit,
    periodCredit,
    closingBalance: movement,
  }
}
