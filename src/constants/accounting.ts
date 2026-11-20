/** Module 11 — Double-entry accounting. Stored UPPERCASE; API uses lowercase via toPublicEnum. */

export const ACCOUNT_TYPES = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
} as const
export type AccountType = (typeof ACCOUNT_TYPES)[keyof typeof ACCOUNT_TYPES]

export const NORMAL_BALANCES = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const
export type NormalBalance = (typeof NORMAL_BALANCES)[keyof typeof NORMAL_BALANCES]

export const ACCOUNT_TYPE_NORMAL_BALANCE: Record<AccountType, NormalBalance> = {
  [ACCOUNT_TYPES.ASSET]: NORMAL_BALANCES.DEBIT,
  [ACCOUNT_TYPES.EXPENSE]: NORMAL_BALANCES.DEBIT,
  [ACCOUNT_TYPES.LIABILITY]: NORMAL_BALANCES.CREDIT,
  [ACCOUNT_TYPES.EQUITY]: NORMAL_BALANCES.CREDIT,
  [ACCOUNT_TYPES.REVENUE]: NORMAL_BALANCES.CREDIT,
}

export const JOURNAL_TYPES = {
  GENERAL: 'GENERAL',
  SALES: 'SALES',
  PURCHASE: 'PURCHASE',
  RECEIPT: 'RECEIPT',
  PAYMENT: 'PAYMENT',
  BANK: 'BANK',
  ADJUSTMENT: 'ADJUSTMENT',
  OPENING_BALANCE: 'OPENING_BALANCE',
  REVERSAL: 'REVERSAL',
  SYSTEM: 'SYSTEM',
} as const
export type JournalType = (typeof JOURNAL_TYPES)[keyof typeof JOURNAL_TYPES]

export const JOURNAL_STATUSES = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
  CANCELLED: 'CANCELLED',
} as const
export type JournalStatus = (typeof JOURNAL_STATUSES)[keyof typeof JOURNAL_STATUSES]

export const PERIOD_STATUSES = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  LOCKED: 'LOCKED',
} as const
export type PeriodStatus = (typeof PERIOD_STATUSES)[keyof typeof PERIOD_STATUSES]

/** Configurable system account roles — never hard-code account ObjectIds in business logic. */
export const ACCOUNT_ROLES = {
  CASH: 'CASH',
  BANK: 'BANK',
  ACCOUNTS_RECEIVABLE: 'ACCOUNTS_RECEIVABLE',
  ACCOUNTS_PAYABLE: 'ACCOUNTS_PAYABLE',
  RENTAL_REVENUE: 'RENTAL_REVENUE',
  RENTAL_EXPENSE: 'RENTAL_EXPENSE',
  CUSTOMER_DEPOSITS: 'CUSTOMER_DEPOSITS',
  REFUND_LIABILITY: 'REFUND_LIABILITY',
  FINE_RECOVERY_RECEIVABLE: 'FINE_RECOVERY_RECEIVABLE',
  FINE_RECOVERY_REVENUE: 'FINE_RECOVERY_REVENUE',
  TOLL_RECOVERY_RECEIVABLE: 'TOLL_RECOVERY_RECEIVABLE',
  TOLL_RECOVERY_REVENUE: 'TOLL_RECOVERY_REVENUE',
  SUSPENSE: 'SUSPENSE',
  SALARY_EXPENSE: 'SALARY_EXPENSE',
  EMPLOYER_CONTRIBUTION_EXPENSE: 'EMPLOYER_CONTRIBUTION_EXPENSE',
  PAYROLL_PAYABLE: 'PAYROLL_PAYABLE',
} as const
export type AccountRole = (typeof ACCOUNT_ROLES)[keyof typeof ACCOUNT_ROLES]

export const SOURCE_MODULES = {
  MANUAL: 'MANUAL',
  FINANCE: 'FINANCE',
  PROCUREMENT: 'PROCUREMENT',
  CHARGES: 'CHARGES',
  ACCOUNTING: 'ACCOUNTING',
  PAYROLL: 'PAYROLL',
} as const

export const DEFAULT_CURRENCY = 'AED'

export const ACCOUNT_SORT_FIELDS = ['code', 'name', 'accountType', 'createdAt'] as const
export const JOURNAL_SORT_FIELDS = ['journalNumber', 'accountingDate', 'createdAt', 'status'] as const
export const PERIOD_SORT_FIELDS = ['startDate', 'endDate', 'createdAt'] as const

/** Default starter chart (seeded on demand; codes are configurable, not hard-coded IDs). */
export const DEFAULT_CHART_SEED: ReadonlyArray<{
  code: string
  name: string
  accountType: AccountType
  role?: AccountRole
  parentCode?: string
}> = [
  { code: '1000', name: 'Assets', accountType: ACCOUNT_TYPES.ASSET },
  { code: '1100', name: 'Cash', accountType: ACCOUNT_TYPES.ASSET, parentCode: '1000', role: ACCOUNT_ROLES.CASH },
  { code: '1110', name: 'Bank', accountType: ACCOUNT_TYPES.ASSET, parentCode: '1000', role: ACCOUNT_ROLES.BANK },
  {
    code: '1200',
    name: 'Accounts Receivable',
    accountType: ACCOUNT_TYPES.ASSET,
    parentCode: '1000',
    role: ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE,
  },
  {
    code: '1250',
    name: 'Fine Recovery Receivable',
    accountType: ACCOUNT_TYPES.ASSET,
    parentCode: '1000',
    role: ACCOUNT_ROLES.FINE_RECOVERY_RECEIVABLE,
  },
  {
    code: '1260',
    name: 'Toll Recovery Receivable',
    accountType: ACCOUNT_TYPES.ASSET,
    parentCode: '1000',
    role: ACCOUNT_ROLES.TOLL_RECOVERY_RECEIVABLE,
  },
  { code: '2000', name: 'Liabilities', accountType: ACCOUNT_TYPES.LIABILITY },
  {
    code: '2100',
    name: 'Accounts Payable',
    accountType: ACCOUNT_TYPES.LIABILITY,
    parentCode: '2000',
    role: ACCOUNT_ROLES.ACCOUNTS_PAYABLE,
  },
  {
    code: '2200',
    name: 'Customer Deposits',
    accountType: ACCOUNT_TYPES.LIABILITY,
    parentCode: '2000',
    role: ACCOUNT_ROLES.CUSTOMER_DEPOSITS,
  },
  {
    code: '2300',
    name: 'Refund Liability',
    accountType: ACCOUNT_TYPES.LIABILITY,
    parentCode: '2000',
    role: ACCOUNT_ROLES.REFUND_LIABILITY,
  },
  { code: '3000', name: 'Equity', accountType: ACCOUNT_TYPES.EQUITY },
  { code: '4000', name: 'Revenue', accountType: ACCOUNT_TYPES.REVENUE },
  {
    code: '4100',
    name: 'Rental Revenue',
    accountType: ACCOUNT_TYPES.REVENUE,
    parentCode: '4000',
    role: ACCOUNT_ROLES.RENTAL_REVENUE,
  },
  {
    code: '4200',
    name: 'Fine Recovery Revenue',
    accountType: ACCOUNT_TYPES.REVENUE,
    parentCode: '4000',
    role: ACCOUNT_ROLES.FINE_RECOVERY_REVENUE,
  },
  {
    code: '4300',
    name: 'Toll Recovery Revenue',
    accountType: ACCOUNT_TYPES.REVENUE,
    parentCode: '4000',
    role: ACCOUNT_ROLES.TOLL_RECOVERY_REVENUE,
  },
  { code: '5000', name: 'Expenses', accountType: ACCOUNT_TYPES.EXPENSE },
  {
    code: '5100',
    name: 'Rental Expense',
    accountType: ACCOUNT_TYPES.EXPENSE,
    parentCode: '5000',
    role: ACCOUNT_ROLES.RENTAL_EXPENSE,
  },
  {
    code: '5200',
    name: 'Salary Expense',
    accountType: ACCOUNT_TYPES.EXPENSE,
    parentCode: '5000',
    role: ACCOUNT_ROLES.SALARY_EXPENSE,
  },
  {
    code: '5210',
    name: 'Employer Contribution Expense',
    accountType: ACCOUNT_TYPES.EXPENSE,
    parentCode: '5000',
    role: ACCOUNT_ROLES.EMPLOYER_CONTRIBUTION_EXPENSE,
  },
  {
    code: '2400',
    name: 'Payroll Payable',
    accountType: ACCOUNT_TYPES.LIABILITY,
    parentCode: '2000',
    role: ACCOUNT_ROLES.PAYROLL_PAYABLE,
  },
  {
    code: '9900',
    name: 'Suspense',
    accountType: ACCOUNT_TYPES.ASSET,
    role: ACCOUNT_ROLES.SUSPENSE,
  },
]
