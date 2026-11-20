import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  adjustLeaveBalanceHandler,
  approveLeaveHandler,
  approveOvertimeHandler,
  assignScheduleHandler,
  cancelLeaveHandler,
  clockInHandler,
  clockOutHandler,
  createHolidayHandler,
  createLeavePolicyHandler,
  createLeaveTypeHandler,
  createOvertimeHandler,
  createScheduleHandler,
  createShiftHandler,
  getAttendanceHandler,
  getLeaveRequestHandler,
  importAttendanceHandler,
  listAttendanceHandler,
  listCorrectionsHandler,
  listEmployeeSchedulesHandler,
  listExceptionsHandler,
  listHolidaysHandler,
  listLeaveBalancesHandler,
  listLeavePoliciesHandler,
  listLeaveRequestsHandler,
  listLeaveTypesHandler,
  listOvertimeHandler,
  listSchedulesHandler,
  listShiftsHandler,
  rejectLeaveHandler,
  rejectOvertimeHandler,
  requestCorrectionHandler,
  reviewCorrectionHandler,
  submitLeaveRequestHandler,
  todayAttendanceHandler,
  updateHolidayHandler,
  updateLeaveTypeHandler,
  updateScheduleHandler,
  updateShiftHandler,
  workforceCalendarHandler,
  workforceSummaryHandler,
} from '../controllers/workforce/workforce.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import { idParamsSchema } from '../validations/common.validation.js'
import {
  approveOvertimeBodySchema,
  assignScheduleBodySchema,
  clockBodySchema,
  correctionBodySchema,
  createHolidayBodySchema,
  createLeavePolicyBodySchema,
  createLeaveTypeBodySchema,
  createOvertimeBodySchema,
  createScheduleBodySchema,
  createShiftBodySchema,
  importAttendanceBodySchema,
  leaveBalanceAdjustBodySchema,
  leaveRequestBodySchema,
  leaveReviewBodySchema,
  listWorkforceQuerySchema,
  reviewCorrectionBodySchema,
  updateHolidayBodySchema,
  updateLeaveTypeBodySchema,
  updateScheduleBodySchema,
  updateShiftBodySchema,
  workforceCalendarQuerySchema,
  workforceSummaryQuerySchema,
} from '../validations/workforce.validation.js'

export const workforceRouter = Router()
workforceRouter.use(authenticate)

workforceRouter.get(
  '/summary',
  requirePermission(PERMISSIONS.ATTENDANCE_VIEW),
  validate({ query: workforceSummaryQuerySchema }),
  workforceSummaryHandler,
)
workforceRouter.get(
  '/calendar',
  requirePermission(PERMISSIONS.ATTENDANCE_VIEW),
  validate({ query: workforceCalendarQuerySchema }),
  workforceCalendarHandler,
)

workforceRouter.get(
  '/schedules',
  requirePermission(PERMISSIONS.SCHEDULE_VIEW),
  validate({ query: listWorkforceQuerySchema }),
  listSchedulesHandler,
)
workforceRouter.post(
  '/schedules',
  requirePermission(PERMISSIONS.SCHEDULE_MANAGE),
  validate({ body: createScheduleBodySchema }),
  createScheduleHandler,
)
workforceRouter.patch(
  '/schedules/:id',
  requirePermission(PERMISSIONS.SCHEDULE_MANAGE),
  validate({ params: idParamsSchema, body: updateScheduleBodySchema }),
  updateScheduleHandler,
)

workforceRouter.get(
  '/shifts',
  requirePermission(PERMISSIONS.SHIFT_VIEW),
  validate({ query: listWorkforceQuerySchema }),
  listShiftsHandler,
)
workforceRouter.post(
  '/shifts',
  requirePermission(PERMISSIONS.SHIFT_MANAGE),
  validate({ body: createShiftBodySchema }),
  createShiftHandler,
)
workforceRouter.patch(
  '/shifts/:id',
  requirePermission(PERMISSIONS.SHIFT_MANAGE),
  validate({ params: idParamsSchema, body: updateShiftBodySchema }),
  updateShiftHandler,
)

workforceRouter.get(
  '/employee-schedules',
  requirePermission(PERMISSIONS.SCHEDULE_VIEW),
  validate({ query: listWorkforceQuerySchema }),
  listEmployeeSchedulesHandler,
)
workforceRouter.post(
  '/employee-schedules',
  requirePermission(PERMISSIONS.SCHEDULE_MANAGE),
  validate({ body: assignScheduleBodySchema }),
  assignScheduleHandler,
)

workforceRouter.get(
  '/attendance/today',
  requirePermission(PERMISSIONS.ATTENDANCE_CLOCK),
  validate({ query: workforceSummaryQuerySchema }),
  todayAttendanceHandler,
)
workforceRouter.get(
  '/attendance',
  requirePermission(PERMISSIONS.ATTENDANCE_VIEW),
  validate({ query: listWorkforceQuerySchema }),
  listAttendanceHandler,
)
workforceRouter.get(
  '/attendance/exceptions',
  requirePermission(PERMISSIONS.ATTENDANCE_MANAGE),
  validate({ query: listWorkforceQuerySchema }),
  listExceptionsHandler,
)
workforceRouter.get(
  '/attendance/corrections',
  requirePermission(PERMISSIONS.ATTENDANCE_VIEW),
  validate({ query: listWorkforceQuerySchema }),
  listCorrectionsHandler,
)
workforceRouter.post(
  '/attendance/clock-in',
  requirePermission(PERMISSIONS.ATTENDANCE_CLOCK),
  validate({ body: clockBodySchema }),
  clockInHandler,
)
workforceRouter.post(
  '/attendance/clock-out',
  requirePermission(PERMISSIONS.ATTENDANCE_CLOCK),
  validate({ body: clockBodySchema }),
  clockOutHandler,
)
workforceRouter.post(
  '/attendance/import',
  requirePermission(PERMISSIONS.ATTENDANCE_MANAGE),
  validate({ body: importAttendanceBodySchema }),
  importAttendanceHandler,
)
workforceRouter.get(
  '/attendance/:id',
  requirePermission(PERMISSIONS.ATTENDANCE_VIEW),
  validate({ params: idParamsSchema }),
  getAttendanceHandler,
)
workforceRouter.post(
  '/attendance/:id/correction',
  requirePermission(PERMISSIONS.ATTENDANCE_CORRECT),
  validate({ params: idParamsSchema, body: correctionBodySchema }),
  requestCorrectionHandler,
)
workforceRouter.post(
  '/attendance/corrections/:id/review',
  requirePermission(PERMISSIONS.ATTENDANCE_APPROVE),
  validate({ params: idParamsSchema, body: reviewCorrectionBodySchema }),
  reviewCorrectionHandler,
)

workforceRouter.get(
  '/leave/types',
  requirePermission(PERMISSIONS.LEAVE_VIEW),
  validate({ query: listWorkforceQuerySchema }),
  listLeaveTypesHandler,
)
workforceRouter.post(
  '/leave/types',
  requirePermission(PERMISSIONS.LEAVE_MANAGE),
  validate({ body: createLeaveTypeBodySchema }),
  createLeaveTypeHandler,
)
workforceRouter.patch(
  '/leave/types/:id',
  requirePermission(PERMISSIONS.LEAVE_MANAGE),
  validate({ params: idParamsSchema, body: updateLeaveTypeBodySchema }),
  updateLeaveTypeHandler,
)

workforceRouter.get(
  '/leave/policies',
  requirePermission(PERMISSIONS.LEAVE_VIEW),
  validate({ query: listWorkforceQuerySchema }),
  listLeavePoliciesHandler,
)
workforceRouter.post(
  '/leave/policies',
  requirePermission(PERMISSIONS.LEAVE_MANAGE),
  validate({ body: createLeavePolicyBodySchema }),
  createLeavePolicyHandler,
)

workforceRouter.get(
  '/leave/balances',
  requirePermission(PERMISSIONS.LEAVE_BALANCE_VIEW),
  validate({ query: listWorkforceQuerySchema }),
  listLeaveBalancesHandler,
)
workforceRouter.post(
  '/leave/balances/adjust',
  requirePermission(PERMISSIONS.LEAVE_BALANCE_MANAGE),
  validate({ body: leaveBalanceAdjustBodySchema }),
  adjustLeaveBalanceHandler,
)

workforceRouter.get(
  '/leave/requests',
  requirePermission(PERMISSIONS.LEAVE_VIEW),
  validate({ query: listWorkforceQuerySchema }),
  listLeaveRequestsHandler,
)
workforceRouter.post(
  '/leave/requests',
  requirePermission(PERMISSIONS.LEAVE_REQUEST),
  validate({ body: leaveRequestBodySchema }),
  submitLeaveRequestHandler,
)
workforceRouter.get(
  '/leave/requests/:id',
  requirePermission(PERMISSIONS.LEAVE_VIEW),
  validate({ params: idParamsSchema }),
  getLeaveRequestHandler,
)
workforceRouter.post(
  '/leave/requests/:id/approve',
  requirePermission(PERMISSIONS.LEAVE_APPROVE),
  validate({ params: idParamsSchema, body: leaveReviewBodySchema }),
  approveLeaveHandler,
)
workforceRouter.post(
  '/leave/requests/:id/reject',
  requirePermission(PERMISSIONS.LEAVE_APPROVE),
  validate({ params: idParamsSchema, body: leaveReviewBodySchema }),
  rejectLeaveHandler,
)
workforceRouter.post(
  '/leave/requests/:id/cancel',
  requirePermission(PERMISSIONS.LEAVE_CANCEL),
  validate({ params: idParamsSchema, body: leaveReviewBodySchema }),
  cancelLeaveHandler,
)

workforceRouter.get(
  '/holidays',
  requirePermission(PERMISSIONS.HOLIDAY_VIEW),
  validate({ query: listWorkforceQuerySchema }),
  listHolidaysHandler,
)
workforceRouter.post(
  '/holidays',
  requirePermission(PERMISSIONS.HOLIDAY_MANAGE),
  validate({ body: createHolidayBodySchema }),
  createHolidayHandler,
)
workforceRouter.patch(
  '/holidays/:id',
  requirePermission(PERMISSIONS.HOLIDAY_MANAGE),
  validate({ params: idParamsSchema, body: updateHolidayBodySchema }),
  updateHolidayHandler,
)

workforceRouter.get(
  '/overtime',
  requirePermission(PERMISSIONS.OVERTIME_VIEW),
  validate({ query: listWorkforceQuerySchema }),
  listOvertimeHandler,
)
workforceRouter.post(
  '/overtime',
  requirePermission(PERMISSIONS.OVERTIME_MANAGE),
  validate({ body: createOvertimeBodySchema }),
  createOvertimeHandler,
)
workforceRouter.post(
  '/overtime/:id/approve',
  requirePermission(PERMISSIONS.OVERTIME_APPROVE),
  validate({ params: idParamsSchema, body: approveOvertimeBodySchema }),
  approveOvertimeHandler,
)
workforceRouter.post(
  '/overtime/:id/reject',
  requirePermission(PERMISSIONS.OVERTIME_APPROVE),
  validate({ params: idParamsSchema }),
  rejectOvertimeHandler,
)
