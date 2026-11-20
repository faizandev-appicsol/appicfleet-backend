import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  approveFineHandler,
  approveRefundHandler,
  approveTollHandler,
  createFineHandler,
  createImportHandler,
  createRefundHandler,
  createTollHandler,
  disputeFineHandler,
  executeRefundHandler,
  getFineHandler,
  getImportHandler,
  getRefundHandler,
  getTollHandler,
  listFinesHandler,
  listImportsHandler,
  listRefundsHandler,
  listTollsHandler,
  recoverFineHandler,
  recoverTollHandler,
  rejectRefundHandler,
  requestRefundHandler,
  resolveDisputeHandler,
  reviewFineHandler,
  reviewTollHandler,
  updateFineHandler,
  updateTollHandler,
  waiveFineHandler,
} from '../controllers/charges/charges.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import { idParamsSchema } from '../validations/common.validation.js'
import {
  createFineBodySchema,
  createImportBodySchema,
  createRefundBodySchema,
  createTollBodySchema,
  disputeFineBodySchema,
  listFinesQuerySchema,
  listImportsQuerySchema,
  listRefundsQuerySchema,
  listTollsQuerySchema,
  reasonBodySchema,
  recoverBodySchema,
  resolveDisputeBodySchema,
  reviewFineBodySchema,
  reviewTollBodySchema,
  updateFineBodySchema,
  updateTollBodySchema,
} from '../validations/charges.validation.js'

export const fineRouter = Router()
export const tollRouter = Router()
export const fineTollImportRouter = Router()
export const refundRouter = Router()

fineRouter.use(authenticate)
tollRouter.use(authenticate)
fineTollImportRouter.use(authenticate)
refundRouter.use(authenticate)

fineRouter.get('/', requirePermission(PERMISSIONS.FINE_VIEW), validate({ query: listFinesQuerySchema }), listFinesHandler)
fineRouter.post('/', requirePermission(PERMISSIONS.FINE_CREATE), validate({ body: createFineBodySchema }), createFineHandler)
fineRouter.get('/:id', requirePermission(PERMISSIONS.FINE_VIEW), validate({ params: idParamsSchema }), getFineHandler)
fineRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.FINE_EDIT),
  validate({ params: idParamsSchema, body: updateFineBodySchema }),
  updateFineHandler,
)
fineRouter.post(
  '/:id/review',
  requirePermission(PERMISSIONS.FINE_REVIEW),
  validate({ params: idParamsSchema, body: reviewFineBodySchema }),
  reviewFineHandler,
)
fineRouter.post('/:id/approve', requirePermission(PERMISSIONS.FINE_APPROVE), validate({ params: idParamsSchema }), approveFineHandler)
fineRouter.post(
  '/:id/waive',
  requirePermission(PERMISSIONS.FINE_WAIVE),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  waiveFineHandler,
)
fineRouter.post(
  '/:id/dispute',
  requirePermission(PERMISSIONS.FINE_DISPUTE),
  validate({ params: idParamsSchema, body: disputeFineBodySchema }),
  disputeFineHandler,
)
fineRouter.post(
  '/:id/resolve-dispute',
  requirePermission(PERMISSIONS.FINE_REVIEW),
  validate({ params: idParamsSchema, body: resolveDisputeBodySchema }),
  resolveDisputeHandler,
)
fineRouter.post(
  '/:id/recover',
  requirePermission(PERMISSIONS.FINE_RECOVER),
  validate({ params: idParamsSchema, body: recoverBodySchema }),
  recoverFineHandler,
)

tollRouter.get('/', requirePermission(PERMISSIONS.TOLL_VIEW), validate({ query: listTollsQuerySchema }), listTollsHandler)
tollRouter.post('/', requirePermission(PERMISSIONS.TOLL_CREATE), validate({ body: createTollBodySchema }), createTollHandler)
tollRouter.get('/:id', requirePermission(PERMISSIONS.TOLL_VIEW), validate({ params: idParamsSchema }), getTollHandler)
tollRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.TOLL_EDIT),
  validate({ params: idParamsSchema, body: updateTollBodySchema }),
  updateTollHandler,
)
tollRouter.post(
  '/:id/review',
  requirePermission(PERMISSIONS.TOLL_REVIEW),
  validate({ params: idParamsSchema, body: reviewTollBodySchema }),
  reviewTollHandler,
)
tollRouter.post('/:id/approve', requirePermission(PERMISSIONS.TOLL_APPROVE), validate({ params: idParamsSchema }), approveTollHandler)
tollRouter.post(
  '/:id/recover',
  requirePermission(PERMISSIONS.TOLL_RECOVER),
  validate({ params: idParamsSchema, body: recoverBodySchema }),
  recoverTollHandler,
)

fineTollImportRouter.get(
  '/',
  requirePermission(PERMISSIONS.FINE_IMPORT_VIEW),
  validate({ query: listImportsQuerySchema }),
  listImportsHandler,
)
fineTollImportRouter.post(
  '/',
  requirePermission(PERMISSIONS.FINE_IMPORT_PROCESS),
  validate({ body: createImportBodySchema }),
  createImportHandler,
)
fineTollImportRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.FINE_IMPORT_VIEW),
  validate({ params: idParamsSchema }),
  getImportHandler,
)
fineTollImportRouter.get(
  '/:id/results',
  requirePermission(PERMISSIONS.FINE_IMPORT_VIEW),
  validate({ params: idParamsSchema }),
  getImportHandler,
)

refundRouter.get('/', requirePermission(PERMISSIONS.REFUND_VIEW), validate({ query: listRefundsQuerySchema }), listRefundsHandler)
refundRouter.post('/', requirePermission(PERMISSIONS.REFUND_CREATE), validate({ body: createRefundBodySchema }), createRefundHandler)
refundRouter.get('/:id', requirePermission(PERMISSIONS.REFUND_VIEW), validate({ params: idParamsSchema }), getRefundHandler)
refundRouter.post('/:id/request', requirePermission(PERMISSIONS.REFUND_CREATE), validate({ params: idParamsSchema }), requestRefundHandler)
refundRouter.post('/:id/approve', requirePermission(PERMISSIONS.REFUND_APPROVE), validate({ params: idParamsSchema }), approveRefundHandler)
refundRouter.post(
  '/:id/reject',
  requirePermission(PERMISSIONS.REFUND_REJECT),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  rejectRefundHandler,
)
refundRouter.post('/:id/execute', requirePermission(PERMISSIONS.REFUND_EXECUTE), validate({ params: idParamsSchema }), executeRefundHandler)
