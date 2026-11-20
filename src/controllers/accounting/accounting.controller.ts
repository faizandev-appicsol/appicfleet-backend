import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  createAccount,
  getAccount,
  listAccountDirectory,
  listAccountTree,
  seedDefaultChart,
  updateAccountRecord,
} from '../../services/accounting/account.service.js'
import {
  closePeriod,
  createFiscalPeriod,
  createFiscalYear,
  listPeriods,
  listYears,
  reopenPeriod,
} from '../../services/accounting/fiscal-period.service.js'
import { getJournal, listJournalDirectory } from '../../services/accounting/journal.service.js'
import {
  getAccountBalanceSummary,
  getGeneralLedger,
  getTrialBalance,
} from '../../services/accounting/ledger.service.js'
import {
  cancelJournal,
  createJournalDraft,
  postJournal,
  reverseJournal,
  updateJournalDraft,
} from '../../services/accounting/posting.service.js'
import { getAccountingOverview, listMappings, upsertMapping } from '../../services/accounting/settings.service.js'
import { postFromOperationalSource } from '../../services/accounting/source-posting.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type { CustomerIdParams } from '../../validations/customer.validation.js'
import type {
  CreateAccountBody,
  CreateFiscalPeriodBody,
  CreateFiscalYearBody,
  CreateJournalBody,
  LedgerQuery,
  ListAccountsQuery,
  ListJournalsQuery,
  MappingBody,
  OverviewQuery,
  SourcePostBody,
  TrialBalanceQuery,
  UpdateAccountBody,
  UpdateJournalBody,
} from '../../validations/accounting.validation.js'

export const overviewHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, OverviewQuery>>(req)
  sendSuccess(res, 'Accounting overview loaded.', await getAccountingOverview(requireAccess(req), query))
})

export const listAccountsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListAccountsQuery>>(req)
  sendSuccess(res, 'Accounts loaded successfully.', await listAccountDirectory(requireAccess(req), query))
})

export const treeAccountsHandler = asyncHandler(async (req, res) => {
  const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined
  sendSuccess(res, 'Account tree loaded successfully.', await listAccountTree(requireAccess(req), organizationId))
})

export const getAccountHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Account loaded successfully.', await getAccount(requireAccess(req), params.id))
})

export const createAccountHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateAccountBody>>(req)
  sendSuccess(res, 'Account created successfully.', await createAccount(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const updateAccountHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<UpdateAccountBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Account updated successfully.', await updateAccountRecord(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const seedChartHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<{ legalEntityId: string; organizationId?: string }>>(req)
  sendSuccess(res, 'Chart of accounts seeded.', await seedDefaultChart(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const listJournalsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListJournalsQuery>>(req)
  sendSuccess(res, 'Journals loaded successfully.', await listJournalDirectory(requireAccess(req), query))
})

export const getJournalHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Journal loaded successfully.', await getJournal(requireAccess(req), params.id))
})

export const createJournalHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateJournalBody>>(req)
  sendSuccess(res, 'Journal draft created.', await createJournalDraft(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const updateJournalHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<UpdateJournalBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Journal draft updated.', await updateJournalDraft(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const postJournalHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Journal posted successfully.', await postJournal(requireAccess(req), params.id, getRequestMeta(req)))
})

export const reverseJournalHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Journal reversed successfully.', await reverseJournal(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const cancelJournalHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Journal cancelled successfully.', await cancelJournal(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const listYearsHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Fiscal years loaded.', await listYears(requireAccess(req), req.query as Record<string, unknown>))
})

export const listPeriodsHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Fiscal periods loaded.', await listPeriods(requireAccess(req), req.query as Record<string, unknown>))
})

export const createYearHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateFiscalYearBody>>(req)
  sendSuccess(res, 'Fiscal year created.', await createFiscalYear(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const createPeriodHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateFiscalPeriodBody>>(req)
  sendSuccess(res, 'Fiscal period created.', await createFiscalPeriod(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const closePeriodHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Fiscal period closed.', await closePeriod(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const reopenPeriodHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Fiscal period reopened.', await reopenPeriod(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const ledgerHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, LedgerQuery>>(req)
  sendSuccess(res, 'General ledger loaded.', await getGeneralLedger(requireAccess(req), query))
})

export const trialBalanceHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, TrialBalanceQuery>>(req)
  sendSuccess(res, 'Trial balance loaded.', await getTrialBalance(requireAccess(req), query))
})

export const accountBalanceHandler = asyncHandler(async (req, res) => {
  const { params, query } = getValidated<ValidatedRequest<unknown, { fiscalPeriodId?: string }, CustomerIdParams>>(req)
  sendSuccess(res, 'Account balance loaded.', await getAccountBalanceSummary(requireAccess(req), params.id, query))
})

export const listMappingsHandler = asyncHandler(async (req, res) => {
  const legalEntityId = String(req.query.legalEntityId ?? '')
  sendSuccess(
    res,
    'Account mappings loaded.',
    await listMappings(requireAccess(req), {
      organizationId: typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined,
      legalEntityId,
    }),
  )
})

export const upsertMappingHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<MappingBody>>(req)
  sendSuccess(res, 'Account mapping saved.', await upsertMapping(requireAccess(req), body, getRequestMeta(req)))
})

export const sourcePostHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<SourcePostBody>>(req)
  sendSuccess(
    res,
    'Source accounting journal posted.',
    await postFromOperationalSource(requireAccess(req), body, getRequestMeta(req)),
    201,
  )
})
