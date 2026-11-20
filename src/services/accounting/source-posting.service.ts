import {
  ACCOUNT_ROLES,
  JOURNAL_TYPES,
  SOURCE_MODULES,
  type AccountRole,
} from '../../constants/accounting.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { findMappedAccountId } from '../../repositories/accounting/accounting.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { normalizeMoney } from '../../utils/money.js'
import { conflict, invalidField } from '../../utils/httpErrors.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { createJournalDraft, postJournal, type JournalLineBody } from './posting.service.js'
import { resolveAccountingOrganization } from './accounting-access.js'

type SourcePostBody = {
  organizationId?: string
  legalEntityId: string
  branchId: string
  sourceModule: 'finance' | 'charges' | 'procurement'
  sourceType: string
  sourceId: string
  accountingDate: Date
  amount: string
  currency?: string
  description: string
  customerId?: string
  vendorId?: string
  invoiceId?: string
  paymentId?: string
  contractId?: string
  idempotencyKey: string
}

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
 * Creates and posts a system journal from an operational source document using configured
 * account mappings. Idempotent via sourceIdempotencyKey. Does not invent tax treatment.
 */
export async function postFromOperationalSource(
  ctx: AccessContext,
  body: SourcePostBody,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_POST)
  const organizationId = resolveAccountingOrganization(ctx, body.organizationId)
  const amount = normalizeMoney(body.amount)
  const sourceType = body.sourceType.toUpperCase()
  let journalType = JOURNAL_TYPES.SYSTEM
  let lines: JournalLineBody[] = []

  if (body.sourceModule === 'finance' && sourceType === 'INVOICE') {
    journalType = JOURNAL_TYPES.SALES
    const ar = await requireMapped(organizationId, body.legalEntityId, ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE)
    const revenue = await requireMapped(organizationId, body.legalEntityId, ACCOUNT_ROLES.RENTAL_REVENUE)
    lines = [
      { accountId: ar, debit: amount, credit: '0.00', customerId: body.customerId, invoiceId: body.invoiceId, contractId: body.contractId },
      { accountId: revenue, debit: '0.00', credit: amount, customerId: body.customerId, invoiceId: body.invoiceId, contractId: body.contractId },
    ]
  } else if (body.sourceModule === 'finance' && sourceType === 'PAYMENT') {
    journalType = JOURNAL_TYPES.RECEIPT
    const cash = await requireMapped(organizationId, body.legalEntityId, ACCOUNT_ROLES.CASH)
    const ar = await requireMapped(organizationId, body.legalEntityId, ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE)
    lines = [
      { accountId: cash, debit: amount, credit: '0.00', customerId: body.customerId, paymentId: body.paymentId, invoiceId: body.invoiceId },
      { accountId: ar, debit: '0.00', credit: amount, customerId: body.customerId, paymentId: body.paymentId, invoiceId: body.invoiceId },
    ]
  } else if (body.sourceModule === 'finance' && sourceType === 'DEPOSIT') {
    journalType = JOURNAL_TYPES.RECEIPT
    const cash = await requireMapped(organizationId, body.legalEntityId, ACCOUNT_ROLES.CASH)
    const liability = await requireMapped(organizationId, body.legalEntityId, ACCOUNT_ROLES.CUSTOMER_DEPOSITS)
    lines = [
      { accountId: cash, debit: amount, credit: '0.00', customerId: body.customerId },
      { accountId: liability, debit: '0.00', credit: amount, customerId: body.customerId, contractId: body.contractId },
    ]
  } else if (body.sourceModule === 'charges' && sourceType === 'FINE_RECOVERY') {
    journalType = JOURNAL_TYPES.SALES
    const receivable = await requireMapped(organizationId, body.legalEntityId, ACCOUNT_ROLES.FINE_RECOVERY_RECEIVABLE)
    const revenue = await requireMapped(organizationId, body.legalEntityId, ACCOUNT_ROLES.FINE_RECOVERY_REVENUE)
    lines = [
      { accountId: receivable, debit: amount, credit: '0.00', customerId: body.customerId, contractId: body.contractId },
      { accountId: revenue, debit: '0.00', credit: amount, customerId: body.customerId, contractId: body.contractId },
    ]
  } else if (body.sourceModule === 'charges' && sourceType === 'TOLL_RECOVERY') {
    journalType = JOURNAL_TYPES.SALES
    const receivable = await requireMapped(organizationId, body.legalEntityId, ACCOUNT_ROLES.TOLL_RECOVERY_RECEIVABLE)
    const revenue = await requireMapped(organizationId, body.legalEntityId, ACCOUNT_ROLES.TOLL_RECOVERY_REVENUE)
    lines = [
      { accountId: receivable, debit: amount, credit: '0.00', customerId: body.customerId, contractId: body.contractId },
      { accountId: revenue, debit: '0.00', credit: amount, customerId: body.customerId, contractId: body.contractId },
    ]
  } else if (body.sourceModule === 'charges' && sourceType === 'REFUND') {
    journalType = JOURNAL_TYPES.PAYMENT
    const liability = await requireMapped(organizationId, body.legalEntityId, ACCOUNT_ROLES.REFUND_LIABILITY)
    const cash = await requireMapped(organizationId, body.legalEntityId, ACCOUNT_ROLES.CASH)
    lines = [
      { accountId: liability, debit: amount, credit: '0.00', customerId: body.customerId },
      { accountId: cash, debit: '0.00', credit: amount, customerId: body.customerId },
    ]
  } else {
    throw invalidField('sourceType', 'Unsupported operational source for accounting posting.')
  }

  const draft = await createJournalDraft(
    ctx,
    {
      organizationId,
      legalEntityId: body.legalEntityId,
      branchId: body.branchId,
      journalType,
      accountingDate: body.accountingDate,
      description: body.description,
      currency: body.currency,
      sourceModule:
        body.sourceModule === 'finance'
          ? SOURCE_MODULES.FINANCE
          : body.sourceModule === 'charges'
            ? SOURCE_MODULES.CHARGES
            : SOURCE_MODULES.PROCUREMENT,
      sourceType,
      sourceId: body.sourceId,
      sourceIdempotencyKey: body.idempotencyKey,
      lines,
    },
    meta,
  )
  return postJournal(ctx, draft.id, meta)
}
