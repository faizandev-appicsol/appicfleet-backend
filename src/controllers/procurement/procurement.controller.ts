import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import { allocateApPayment, createApPayment } from '../../services/procurement/ap-payment.service.js'
import {
  allocateBorrowCost,
  createBorrowCostTerm,
  listBorrowTermsForVehicle,
} from '../../services/procurement/borrow-cost.service.js'
import {
  approveExpense,
  createExpenseDraft,
  getExpense,
  listExpenseCategoryDirectory,
  listExpenseDirectory,
  postExpense,
  submitExpense,
  updateExpense,
} from '../../services/procurement/expense.service.js'
import {
  approveLpo,
  cancelLpo,
  createLpoDraft,
  getLpo,
  listLpoDirectory,
  submitLpo,
  updateLpo,
} from '../../services/procurement/lpo.service.js'
import {
  completeReminder,
  createReminder,
  dismissReminder,
  listReminderDirectory,
} from '../../services/procurement/reminder.service.js'
import {
  addVendorDocumentMeta,
  createVendor,
  disableVendor,
  getVendor,
  listVendorDirectory,
  updateVendorRecord,
} from '../../services/procurement/vendor.service.js'
import {
  approveVendorBill,
  cancelVendorBill,
  createVendorBillDraft,
  getVendorBill,
  listVendorBillDirectory,
  postVendorBill,
  submitVendorBill,
} from '../../services/procurement/vendor-bill.service.js'
import {
  approveWorkOrder,
  cancelWorkOrder,
  completeWorkOrder,
  createWorkOrderDraft,
  getWorkOrder,
  listWorkOrderDirectory,
  requestWorkOrder,
  scheduleWorkOrder,
  startWorkOrder,
  updateWorkOrderDraft,
} from '../../services/procurement/work-order.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type { CustomerIdParams } from '../../validations/customer.validation.js'
import type {
  AllocateApPaymentBody,
  AllocateBorrowCostBody,
  CompleteWorkOrderBody,
  CreateApPaymentBody,
  CreateBorrowTermBody,
  CreateExpenseBody,
  CreateLpoBody,
  CreateReminderBody,
  CreateVendorBillBody,
  CreateVendorBody,
  CreateWorkOrderBody,
  ListExpensesQuery,
  ListLposQuery,
  ListRemindersQuery,
  ListVendorBillsQuery,
  ListVendorsQuery,
  ListWorkOrdersQuery,
  ScheduleWorkOrderBody,
  UpdateExpenseBody,
  UpdateLpoBody,
  UpdateVendorBody,
  UpdateWorkOrderBody,
} from '../../validations/procurement.validation.js'

export const listVendorsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListVendorsQuery>>(req)
  sendSuccess(res, 'Vendors loaded successfully.', await listVendorDirectory(requireAccess(req), query))
})

export const getVendorHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Vendor loaded successfully.', await getVendor(requireAccess(req), params.id))
})

export const createVendorHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateVendorBody>>(req)
  sendSuccess(res, 'Vendor created successfully.', await createVendor(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const updateVendorHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<UpdateVendorBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Vendor updated successfully.', await updateVendorRecord(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const disableVendorHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Vendor disabled successfully.', await disableVendor(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const addVendorDocumentHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<
      {
        documentType: string
        fileName: string
        storageKey: string
        mimeType?: string
        expiresAt?: Date
        notes?: string
      },
      unknown,
      CustomerIdParams
    >
  >(req)
  sendSuccess(res, 'Vendor document recorded successfully.', await addVendorDocumentMeta(requireAccess(req), params.id, body, getRequestMeta(req)), 201)
})

export const listLposHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListLposQuery>>(req)
  sendSuccess(res, 'LPOs loaded successfully.', await listLpoDirectory(requireAccess(req), query))
})

export const getLpoHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'LPO loaded successfully.', await getLpo(requireAccess(req), params.id))
})

export const createLpoHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateLpoBody>>(req)
  sendSuccess(res, 'LPO draft saved successfully.', await createLpoDraft(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const updateLpoHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<UpdateLpoBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'LPO draft updated successfully.', await updateLpo(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const submitLpoHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'LPO submitted successfully.', await submitLpo(requireAccess(req), params.id, getRequestMeta(req)))
})

export const approveLpoHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'LPO approved successfully.', await approveLpo(requireAccess(req), params.id, getRequestMeta(req)))
})

export const cancelLpoHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'LPO cancelled successfully.', await cancelLpo(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const listVendorBillsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListVendorBillsQuery>>(req)
  sendSuccess(res, 'Vendor bills loaded successfully.', await listVendorBillDirectory(requireAccess(req), query))
})

export const getVendorBillHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Vendor bill loaded successfully.', await getVendorBill(requireAccess(req), params.id))
})

export const createVendorBillHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateVendorBillBody>>(req)
  sendSuccess(res, 'Vendor bill draft saved successfully.', await createVendorBillDraft(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const submitVendorBillHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Vendor bill submitted successfully.', await submitVendorBill(requireAccess(req), params.id, getRequestMeta(req)))
})

export const approveVendorBillHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Vendor bill approved successfully.', await approveVendorBill(requireAccess(req), params.id, getRequestMeta(req)))
})

export const postVendorBillHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Vendor bill posted successfully.', await postVendorBill(requireAccess(req), params.id, getRequestMeta(req)))
})

export const cancelVendorBillHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Vendor bill cancelled successfully.', await cancelVendorBill(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const listExpenseCategoriesHandler = asyncHandler(async (req, res) => {
  const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined
  sendSuccess(res, 'Expense categories loaded successfully.', await listExpenseCategoryDirectory(requireAccess(req), organizationId))
})

export const listExpensesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListExpensesQuery>>(req)
  sendSuccess(res, 'Expenses loaded successfully.', await listExpenseDirectory(requireAccess(req), query))
})

export const getExpenseHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Expense loaded successfully.', await getExpense(requireAccess(req), params.id))
})

export const createExpenseHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateExpenseBody>>(req)
  sendSuccess(res, 'Expense draft saved successfully.', await createExpenseDraft(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const updateExpenseHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<UpdateExpenseBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Expense draft updated successfully.', await updateExpense(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const submitExpenseHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Expense submitted successfully.', await submitExpense(requireAccess(req), params.id, getRequestMeta(req)))
})

export const approveExpenseHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Expense approved successfully.', await approveExpense(requireAccess(req), params.id, getRequestMeta(req)))
})

export const postExpenseHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Expense posted successfully.', await postExpense(requireAccess(req), params.id, getRequestMeta(req)))
})

export const listWorkOrdersHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListWorkOrdersQuery>>(req)
  sendSuccess(res, 'Work orders loaded successfully.', await listWorkOrderDirectory(requireAccess(req), query))
})

export const getWorkOrderHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Work order loaded successfully.', await getWorkOrder(requireAccess(req), params.id))
})

export const createWorkOrderHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateWorkOrderBody>>(req)
  sendSuccess(res, 'Work order draft saved successfully.', await createWorkOrderDraft(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const updateWorkOrderHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<UpdateWorkOrderBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Work order updated successfully.', await updateWorkOrderDraft(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const requestWorkOrderHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Work order requested successfully.', await requestWorkOrder(requireAccess(req), params.id, getRequestMeta(req)))
})

export const approveWorkOrderHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Work order approved successfully.', await approveWorkOrder(requireAccess(req), params.id, getRequestMeta(req)))
})

export const scheduleWorkOrderHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<ScheduleWorkOrderBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Work order scheduled successfully.', await scheduleWorkOrder(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const startWorkOrderHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Work order started successfully.', await startWorkOrder(requireAccess(req), params.id, getRequestMeta(req)))
})

export const completeWorkOrderHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<CompleteWorkOrderBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Work order completed successfully.', await completeWorkOrder(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const cancelWorkOrderHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Work order cancelled successfully.', await cancelWorkOrder(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const listRemindersHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListRemindersQuery>>(req)
  sendSuccess(res, 'Service reminders loaded successfully.', await listReminderDirectory(requireAccess(req), query))
})

export const createReminderHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateReminderBody>>(req)
  sendSuccess(res, 'Service reminder created successfully.', await createReminder(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const completeReminderHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ workOrderId?: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Service reminder completed successfully.', await completeReminder(requireAccess(req), params.id, body.workOrderId, getRequestMeta(req)))
})

export const dismissReminderHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Service reminder dismissed successfully.', await dismissReminder(requireAccess(req), params.id, getRequestMeta(req)))
})

export const createBorrowTermHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateBorrowTermBody>>(req)
  sendSuccess(res, 'Borrow cost term saved successfully.', await createBorrowCostTerm(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const listBorrowTermsHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Borrow cost terms loaded successfully.', await listBorrowTermsForVehicle(requireAccess(req), params.id))
})

export const allocateBorrowCostHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<AllocateBorrowCostBody>>(req)
  sendSuccess(res, 'Borrow cost allocated successfully.', await allocateBorrowCost(requireAccess(req), body, getRequestMeta(req)))
})

export const createApPaymentHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateApPaymentBody>>(req)
  sendSuccess(res, 'AP payment created successfully.', await createApPayment(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const allocateApPaymentHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<AllocateApPaymentBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'AP payment allocated successfully.', await allocateApPayment(requireAccess(req), params.id, body, getRequestMeta(req)))
})
