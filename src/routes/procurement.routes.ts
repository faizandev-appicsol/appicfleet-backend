import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  addVendorDocumentHandler,
  allocateApPaymentHandler,
  allocateBorrowCostHandler,
  approveExpenseHandler,
  approveLpoHandler,
  approveVendorBillHandler,
  approveWorkOrderHandler,
  cancelLpoHandler,
  cancelVendorBillHandler,
  cancelWorkOrderHandler,
  completeReminderHandler,
  completeWorkOrderHandler,
  createApPaymentHandler,
  createBorrowTermHandler,
  createExpenseHandler,
  createLpoHandler,
  createReminderHandler,
  createVendorBillHandler,
  createVendorHandler,
  createWorkOrderHandler,
  disableVendorHandler,
  dismissReminderHandler,
  getExpenseHandler,
  getLpoHandler,
  getVendorBillHandler,
  getVendorHandler,
  getWorkOrderHandler,
  listBorrowTermsHandler,
  listExpenseCategoriesHandler,
  listExpensesHandler,
  listLposHandler,
  listRemindersHandler,
  listVendorBillsHandler,
  listVendorsHandler,
  listWorkOrdersHandler,
  postExpenseHandler,
  postVendorBillHandler,
  requestWorkOrderHandler,
  scheduleWorkOrderHandler,
  startWorkOrderHandler,
  submitExpenseHandler,
  submitLpoHandler,
  submitVendorBillHandler,
  updateExpenseHandler,
  updateLpoHandler,
  updateVendorHandler,
  updateWorkOrderHandler,
} from '../controllers/procurement/procurement.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import { idParamsSchema } from '../validations/common.validation.js'
import {
  allocateApPaymentBodySchema,
  allocateBorrowCostBodySchema,
  completeReminderBodySchema,
  completeWorkOrderBodySchema,
  createApPaymentBodySchema,
  createBorrowTermBodySchema,
  createExpenseBodySchema,
  createLpoBodySchema,
  createReminderBodySchema,
  createVendorBillBodySchema,
  createVendorBodySchema,
  createWorkOrderBodySchema,
  listExpensesQuerySchema,
  listLposQuerySchema,
  listRemindersQuerySchema,
  listVendorBillsQuerySchema,
  listVendorsQuerySchema,
  listWorkOrdersQuerySchema,
  reasonBodySchema,
  scheduleWorkOrderBodySchema,
  updateExpenseBodySchema,
  updateLpoBodySchema,
  updateVendorBodySchema,
  updateWorkOrderBodySchema,
  vendorDocumentBodySchema,
} from '../validations/procurement.validation.js'

export const vendorRouter = Router()
export const lpoRouter = Router()
export const vendorBillRouter = Router()
export const expenseRouter = Router()
export const workOrderRouter = Router()
export const serviceReminderRouter = Router()
export const borrowCostRouter = Router()
export const apPaymentRouter = Router()

vendorRouter.use(authenticate)
lpoRouter.use(authenticate)
vendorBillRouter.use(authenticate)
expenseRouter.use(authenticate)
workOrderRouter.use(authenticate)
serviceReminderRouter.use(authenticate)
borrowCostRouter.use(authenticate)
apPaymentRouter.use(authenticate)

vendorRouter.get('/', requirePermission(PERMISSIONS.VENDOR_VIEW), validate({ query: listVendorsQuerySchema }), listVendorsHandler)
vendorRouter.post('/', requirePermission(PERMISSIONS.VENDOR_CREATE), validate({ body: createVendorBodySchema }), createVendorHandler)
vendorRouter.get('/:id', requirePermission(PERMISSIONS.VENDOR_VIEW), validate({ params: idParamsSchema }), getVendorHandler)
vendorRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.VENDOR_EDIT),
  validate({ params: idParamsSchema, body: updateVendorBodySchema }),
  updateVendorHandler,
)
vendorRouter.post(
  '/:id/disable',
  requirePermission(PERMISSIONS.VENDOR_DISABLE),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  disableVendorHandler,
)
vendorRouter.post(
  '/:id/documents',
  requirePermission(PERMISSIONS.VENDOR_EDIT),
  validate({ params: idParamsSchema, body: vendorDocumentBodySchema }),
  addVendorDocumentHandler,
)

lpoRouter.get('/', requirePermission(PERMISSIONS.LPO_VIEW), validate({ query: listLposQuerySchema }), listLposHandler)
lpoRouter.post('/', requirePermission(PERMISSIONS.LPO_CREATE), validate({ body: createLpoBodySchema }), createLpoHandler)
lpoRouter.get('/:id', requirePermission(PERMISSIONS.LPO_VIEW), validate({ params: idParamsSchema }), getLpoHandler)
lpoRouter.patch('/:id', requirePermission(PERMISSIONS.LPO_EDIT), validate({ params: idParamsSchema, body: updateLpoBodySchema }), updateLpoHandler)
lpoRouter.post('/:id/submit', requirePermission(PERMISSIONS.LPO_SUBMIT), validate({ params: idParamsSchema }), submitLpoHandler)
lpoRouter.post('/:id/approve', requirePermission(PERMISSIONS.LPO_APPROVE), validate({ params: idParamsSchema }), approveLpoHandler)
lpoRouter.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.LPO_CANCEL),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  cancelLpoHandler,
)

vendorBillRouter.get('/', requirePermission(PERMISSIONS.VENDOR_BILL_VIEW), validate({ query: listVendorBillsQuerySchema }), listVendorBillsHandler)
vendorBillRouter.post('/', requirePermission(PERMISSIONS.VENDOR_BILL_CREATE), validate({ body: createVendorBillBodySchema }), createVendorBillHandler)
vendorBillRouter.get('/:id', requirePermission(PERMISSIONS.VENDOR_BILL_VIEW), validate({ params: idParamsSchema }), getVendorBillHandler)
vendorBillRouter.post('/:id/submit', requirePermission(PERMISSIONS.VENDOR_BILL_EDIT), validate({ params: idParamsSchema }), submitVendorBillHandler)
vendorBillRouter.post('/:id/approve', requirePermission(PERMISSIONS.VENDOR_BILL_APPROVE), validate({ params: idParamsSchema }), approveVendorBillHandler)
vendorBillRouter.post('/:id/post', requirePermission(PERMISSIONS.VENDOR_BILL_POST), validate({ params: idParamsSchema }), postVendorBillHandler)
vendorBillRouter.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.VENDOR_BILL_EDIT),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  cancelVendorBillHandler,
)

expenseRouter.get('/categories', requirePermission(PERMISSIONS.EXPENSE_VIEW), listExpenseCategoriesHandler)
expenseRouter.get('/', requirePermission(PERMISSIONS.EXPENSE_VIEW), validate({ query: listExpensesQuerySchema }), listExpensesHandler)
expenseRouter.post('/', requirePermission(PERMISSIONS.EXPENSE_CREATE), validate({ body: createExpenseBodySchema }), createExpenseHandler)
expenseRouter.get('/:id', requirePermission(PERMISSIONS.EXPENSE_VIEW), validate({ params: idParamsSchema }), getExpenseHandler)
expenseRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.EXPENSE_EDIT),
  validate({ params: idParamsSchema, body: updateExpenseBodySchema }),
  updateExpenseHandler,
)
expenseRouter.post('/:id/submit', requirePermission(PERMISSIONS.EXPENSE_SUBMIT), validate({ params: idParamsSchema }), submitExpenseHandler)
expenseRouter.post('/:id/approve', requirePermission(PERMISSIONS.EXPENSE_APPROVE), validate({ params: idParamsSchema }), approveExpenseHandler)
expenseRouter.post('/:id/post', requirePermission(PERMISSIONS.EXPENSE_POST), validate({ params: idParamsSchema }), postExpenseHandler)

workOrderRouter.get('/', requirePermission(PERMISSIONS.SERVICE_VIEW), validate({ query: listWorkOrdersQuerySchema }), listWorkOrdersHandler)
workOrderRouter.post('/', requirePermission(PERMISSIONS.SERVICE_CREATE), validate({ body: createWorkOrderBodySchema }), createWorkOrderHandler)
workOrderRouter.get('/:id', requirePermission(PERMISSIONS.SERVICE_VIEW), validate({ params: idParamsSchema }), getWorkOrderHandler)
workOrderRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.SERVICE_EDIT),
  validate({ params: idParamsSchema, body: updateWorkOrderBodySchema }),
  updateWorkOrderHandler,
)
workOrderRouter.post('/:id/request', requirePermission(PERMISSIONS.SERVICE_EDIT), validate({ params: idParamsSchema }), requestWorkOrderHandler)
workOrderRouter.post('/:id/approve', requirePermission(PERMISSIONS.SERVICE_APPROVE), validate({ params: idParamsSchema }), approveWorkOrderHandler)
workOrderRouter.post(
  '/:id/schedule',
  requirePermission(PERMISSIONS.SERVICE_SCHEDULE),
  validate({ params: idParamsSchema, body: scheduleWorkOrderBodySchema }),
  scheduleWorkOrderHandler,
)
workOrderRouter.post('/:id/start', requirePermission(PERMISSIONS.SERVICE_EDIT), validate({ params: idParamsSchema }), startWorkOrderHandler)
workOrderRouter.post(
  '/:id/complete',
  requirePermission(PERMISSIONS.SERVICE_COMPLETE),
  validate({ params: idParamsSchema, body: completeWorkOrderBodySchema }),
  completeWorkOrderHandler,
)
workOrderRouter.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.SERVICE_EDIT),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  cancelWorkOrderHandler,
)

serviceReminderRouter.get('/', requirePermission(PERMISSIONS.SERVICE_REMINDER_VIEW), validate({ query: listRemindersQuerySchema }), listRemindersHandler)
serviceReminderRouter.post('/', requirePermission(PERMISSIONS.SERVICE_REMINDER_CREATE), validate({ body: createReminderBodySchema }), createReminderHandler)
serviceReminderRouter.post(
  '/:id/complete',
  requirePermission(PERMISSIONS.SERVICE_REMINDER_MANAGE),
  validate({ params: idParamsSchema, body: completeReminderBodySchema }),
  completeReminderHandler,
)
serviceReminderRouter.post(
  '/:id/dismiss',
  requirePermission(PERMISSIONS.SERVICE_REMINDER_MANAGE),
  validate({ params: idParamsSchema }),
  dismissReminderHandler,
)

borrowCostRouter.post('/terms', requirePermission(PERMISSIONS.VENDOR_EDIT), validate({ body: createBorrowTermBodySchema }), createBorrowTermHandler)
borrowCostRouter.get('/vehicles/:id/terms', requirePermission(PERMISSIONS.VENDOR_VIEW), validate({ params: idParamsSchema }), listBorrowTermsHandler)
borrowCostRouter.post('/allocate', requirePermission(PERMISSIONS.VENDOR_VIEW), validate({ body: allocateBorrowCostBodySchema }), allocateBorrowCostHandler)

apPaymentRouter.post('/', requirePermission(PERMISSIONS.AP_PAYMENT_CREATE), validate({ body: createApPaymentBodySchema }), createApPaymentHandler)
apPaymentRouter.post(
  '/:id/allocate',
  requirePermission(PERMISSIONS.AP_PAYMENT_ALLOCATE),
  validate({ params: idParamsSchema, body: allocateApPaymentBodySchema }),
  allocateApPaymentHandler,
)
