import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  clockIn,
  clockOut,
  getAttendance,
  getTodayAttendance,
  importAttendanceBatch,
  listAttendanceService,
  listCorrectionsService,
  listExceptionsService,
  requestCorrection,
  reviewCorrection,
} from '../../services/workforce/attendance.service.js'
import {
  createHoliday,
  listHolidaysService,
  updateHolidayService,
} from '../../services/workforce/holiday.service.js'
import {
  adjustLeaveBalance,
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeavePolicy,
  createLeaveType,
  getLeaveRequest,
  listLeaveBalancesService,
  listLeavePoliciesService,
  listLeaveRequestsService,
  listLeaveTypesService,
  rejectLeaveRequest,
  submitLeaveRequest,
  updateLeaveTypeService,
} from '../../services/workforce/leave.service.js'
import {
  approveOvertimeRequest,
  createOvertimeRequest,
  listOvertimeService,
  rejectOvertimeRequest,
} from '../../services/workforce/overtime.service.js'
import {
  assignEmployeeSchedule,
  createShift,
  createWorkSchedule,
  listEmployeeSchedulesService,
  listShiftsService,
  listWorkSchedulesService,
  updateShiftService,
  updateWorkScheduleService,
} from '../../services/workforce/schedule.service.js'
import {
  workforceCalendar,
  workforceDashboard,
} from '../../services/workforce/summary.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'

export const workforceSummaryHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Workforce summary loaded.', await workforceDashboard(requireAccess(req), query))
})

export const workforceCalendarHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Workforce calendar loaded.',
    await workforceCalendar(requireAccess(req), query as never),
  )
})

export const listSchedulesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Work schedules loaded.',
    await listWorkSchedulesService(requireAccess(req), query as never),
  )
})

export const createScheduleHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Work schedule created.',
    await createWorkSchedule(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const updateScheduleHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Work schedule updated.',
    await updateWorkScheduleService(requireAccess(req), params.id, body, getRequestMeta(req)),
  )
})

export const listShiftsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Shifts loaded.', await listShiftsService(requireAccess(req), query as never))
})

export const createShiftHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Shift created.',
    await createShift(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const updateShiftHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Shift updated.',
    await updateShiftService(requireAccess(req), params.id, body, getRequestMeta(req)),
  )
})

export const listEmployeeSchedulesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Employee schedules loaded.',
    await listEmployeeSchedulesService(requireAccess(req), query as never),
  )
})

export const assignScheduleHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Schedule assigned.',
    await assignEmployeeSchedule(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const todayAttendanceHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string }>>(req)
  sendSuccess(
    res,
    'Today attendance loaded.',
    await getTodayAttendance(requireAccess(req), query.organizationId),
  )
})

export const listAttendanceHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Attendance loaded.',
    await listAttendanceService(requireAccess(req), query as never),
  )
})

export const getAttendanceHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Attendance loaded.', await getAttendance(requireAccess(req), params.id))
})

export const clockInHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Clock-in recorded.',
    await clockIn(requireAccess(req), body as never, getRequestMeta(req)),
  )
})

export const clockOutHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Clock-out recorded.',
    await clockOut(requireAccess(req), body as never, getRequestMeta(req)),
  )
})

export const requestCorrectionHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Correction requested.',
    await requestCorrection(requireAccess(req), params.id, body as never, getRequestMeta(req)),
    201,
  )
})

export const reviewCorrectionHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Correction reviewed.',
    await reviewCorrection(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const listCorrectionsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Corrections loaded.',
    await listCorrectionsService(requireAccess(req), query as never),
  )
})

export const listExceptionsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Exceptions loaded.',
    await listExceptionsService(requireAccess(req), query as never),
  )
})

export const importAttendanceHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Attendance import accepted.',
    await importAttendanceBatch(requireAccess(req), body as never),
    202,
  )
})

export const listLeaveTypesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Leave types loaded.',
    await listLeaveTypesService(requireAccess(req), query as never),
  )
})

export const createLeaveTypeHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Leave type created.',
    await createLeaveType(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const updateLeaveTypeHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Leave type updated.',
    await updateLeaveTypeService(requireAccess(req), params.id, body),
  )
})

export const listLeavePoliciesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Leave policies loaded.',
    await listLeavePoliciesService(requireAccess(req), query as never),
  )
})

export const createLeavePolicyHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Leave policy created.',
    await createLeavePolicy(requireAccess(req), body as never),
    201,
  )
})

export const listLeaveBalancesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Leave balances loaded.',
    await listLeaveBalancesService(requireAccess(req), query as never),
  )
})

export const adjustLeaveBalanceHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Leave balance adjusted.',
    await adjustLeaveBalance(requireAccess(req), body as never, getRequestMeta(req)),
  )
})

export const listLeaveRequestsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Leave requests loaded.',
    await listLeaveRequestsService(requireAccess(req), query as never),
  )
})

export const getLeaveRequestHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Leave request loaded.', await getLeaveRequest(requireAccess(req), params.id))
})

export const submitLeaveRequestHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Leave request submitted.',
    await submitLeaveRequest(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const approveLeaveHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Leave approved.',
    await approveLeaveRequest(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const rejectLeaveHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Leave rejected.',
    await rejectLeaveRequest(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const cancelLeaveHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Leave cancelled.',
    await cancelLeaveRequest(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const listHolidaysHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Holidays loaded.', await listHolidaysService(requireAccess(req), query as never))
})

export const createHolidayHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Holiday created.',
    await createHoliday(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const updateHolidayHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Holiday updated.',
    await updateHolidayService(requireAccess(req), params.id, body, getRequestMeta(req)),
  )
})

export const listOvertimeHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Overtime loaded.', await listOvertimeService(requireAccess(req), query as never))
})

export const createOvertimeHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Overtime created.',
    await createOvertimeRequest(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const approveOvertimeHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Overtime approved.',
    await approveOvertimeRequest(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const rejectOvertimeHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Overtime rejected.', await rejectOvertimeRequest(requireAccess(req), params.id))
})
