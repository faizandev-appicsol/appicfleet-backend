import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  accountBalanceHandler,
  cancelJournalHandler,
  closePeriodHandler,
  createAccountHandler,
  createJournalHandler,
  createPeriodHandler,
  createYearHandler,
  getAccountHandler,
  getJournalHandler,
  ledgerHandler,
  listAccountsHandler,
  listJournalsHandler,
  listMappingsHandler,
  listPeriodsHandler,
  listYearsHandler,
  overviewHandler,
  postJournalHandler,
  reopenPeriodHandler,
  reverseJournalHandler,
  seedChartHandler,
  sourcePostHandler,
  treeAccountsHandler,
  trialBalanceHandler,
  updateAccountHandler,
  updateJournalHandler,
  upsertMappingHandler,
} from '../controllers/accounting/accounting.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import { idParamsSchema } from '../validations/common.validation.js'
import {
  createAccountBodySchema,
  createFiscalPeriodBodySchema,
  createFiscalYearBodySchema,
  createJournalBodySchema,
  ledgerQuerySchema,
  listAccountsQuerySchema,
  listJournalsQuerySchema,
  listMappingsQuerySchema,
  listPeriodsQuerySchema,
  mappingBodySchema,
  overviewQuerySchema,
  reasonBodySchema,
  seedChartBodySchema,
  sourcePostBodySchema,
  trialBalanceQuerySchema,
  updateAccountBodySchema,
  updateJournalBodySchema,
} from '../validations/accounting.validation.js'

export const accountingRouter = Router()
accountingRouter.use(authenticate)

accountingRouter.get('/overview', requirePermission(PERMISSIONS.ACCOUNTING_VIEW), validate({ query: overviewQuerySchema }), overviewHandler)

accountingRouter.get('/accounts', requirePermission(PERMISSIONS.ACCOUNTING_VIEW), validate({ query: listAccountsQuerySchema }), listAccountsHandler)
accountingRouter.get('/accounts/tree', requirePermission(PERMISSIONS.ACCOUNTING_VIEW), treeAccountsHandler)
accountingRouter.post('/accounts', requirePermission(PERMISSIONS.ACCOUNTING_MANAGE_ACCOUNTS), validate({ body: createAccountBodySchema }), createAccountHandler)
accountingRouter.post('/accounts/seed', requirePermission(PERMISSIONS.ACCOUNTING_MANAGE_ACCOUNTS), validate({ body: seedChartBodySchema }), seedChartHandler)
accountingRouter.get('/accounts/:id', requirePermission(PERMISSIONS.ACCOUNTING_VIEW), validate({ params: idParamsSchema }), getAccountHandler)
accountingRouter.patch('/accounts/:id', requirePermission(PERMISSIONS.ACCOUNTING_MANAGE_ACCOUNTS), validate({ params: idParamsSchema, body: updateAccountBodySchema }), updateAccountHandler)
accountingRouter.get('/accounts/:id/balance', requirePermission(PERMISSIONS.ACCOUNTING_VIEW_LEDGER), validate({ params: idParamsSchema }), accountBalanceHandler)

accountingRouter.get('/journals', requirePermission(PERMISSIONS.ACCOUNTING_VIEW), validate({ query: listJournalsQuerySchema }), listJournalsHandler)
accountingRouter.post('/journals', requirePermission(PERMISSIONS.ACCOUNTING_CREATE), validate({ body: createJournalBodySchema }), createJournalHandler)
accountingRouter.get('/journals/:id', requirePermission(PERMISSIONS.ACCOUNTING_VIEW), validate({ params: idParamsSchema }), getJournalHandler)
accountingRouter.patch('/journals/:id', requirePermission(PERMISSIONS.ACCOUNTING_EDIT), validate({ params: idParamsSchema, body: updateJournalBodySchema }), updateJournalHandler)
accountingRouter.post('/journals/:id/post', requirePermission(PERMISSIONS.ACCOUNTING_POST), validate({ params: idParamsSchema }), postJournalHandler)
accountingRouter.post('/journals/:id/reverse', requirePermission(PERMISSIONS.ACCOUNTING_REVERSE), validate({ params: idParamsSchema, body: reasonBodySchema }), reverseJournalHandler)
accountingRouter.post('/journals/:id/cancel', requirePermission(PERMISSIONS.ACCOUNTING_EDIT), validate({ params: idParamsSchema, body: reasonBodySchema }), cancelJournalHandler)

accountingRouter.get('/fiscal-years', requirePermission(PERMISSIONS.ACCOUNTING_VIEW), validate({ query: listPeriodsQuerySchema }), listYearsHandler)
accountingRouter.post('/fiscal-years', requirePermission(PERMISSIONS.ACCOUNTING_CREATE), validate({ body: createFiscalYearBodySchema }), createYearHandler)
accountingRouter.get('/fiscal-periods', requirePermission(PERMISSIONS.ACCOUNTING_VIEW), validate({ query: listPeriodsQuerySchema }), listPeriodsHandler)
accountingRouter.post('/fiscal-periods', requirePermission(PERMISSIONS.ACCOUNTING_CREATE), validate({ body: createFiscalPeriodBodySchema }), createPeriodHandler)
accountingRouter.post('/fiscal-periods/:id/close', requirePermission(PERMISSIONS.ACCOUNTING_CLOSE_PERIOD), validate({ params: idParamsSchema, body: reasonBodySchema }), closePeriodHandler)
accountingRouter.post('/fiscal-periods/:id/reopen', requirePermission(PERMISSIONS.ACCOUNTING_REOPEN_PERIOD), validate({ params: idParamsSchema, body: reasonBodySchema }), reopenPeriodHandler)

accountingRouter.get('/ledger', requirePermission(PERMISSIONS.ACCOUNTING_VIEW_LEDGER), validate({ query: ledgerQuerySchema }), ledgerHandler)
accountingRouter.get('/trial-balance', requirePermission(PERMISSIONS.ACCOUNTING_VIEW_TRIAL_BALANCE), validate({ query: trialBalanceQuerySchema }), trialBalanceHandler)

accountingRouter.get('/mappings', requirePermission(PERMISSIONS.ACCOUNTING_VIEW), validate({ query: listMappingsQuerySchema }), listMappingsHandler)
accountingRouter.put('/mappings', requirePermission(PERMISSIONS.ACCOUNTING_MANAGE_ACCOUNTS), validate({ body: mappingBodySchema }), upsertMappingHandler)

accountingRouter.post('/source-postings', requirePermission(PERMISSIONS.ACCOUNTING_POST), validate({ body: sourcePostBodySchema }), sourcePostHandler)
