import {
  countAttendanceByStatus,
  countPendingCorrections,
  countPendingLeave,
  listAttendance,
  listLeaveRequests,
  listHolidays,
  listAssignments,
} from '../../repositories/workforce/workforce.repository.js'
import type { AccessContext } from '../../types/access.js'
import { getZonedYmd, resolveAttendanceTimezone } from './attendance-timezone.js'
import { branchScopeForList, requireWorkforceOrganization } from './workforce-access.js'

export async function workforceDashboard(ctx: AccessContext, query: { organizationId?: string }) {
  const organizationId = await requireWorkforceOrganization(ctx, query.organizationId)
  const branchIds = branchScopeForList(ctx)
  const today = getZonedYmd(new Date(), resolveAttendanceTimezone({}))

  const [byStatus, pendingCorrections, pendingLeave, onLeave] = await Promise.all([
    countAttendanceByStatus(organizationId, today, branchIds),
    countPendingCorrections(organizationId, branchIds),
    countPendingLeave(organizationId, branchIds),
    listLeaveRequests({
      organizationId,
      status: 'APPROVED',
      branchIds,
      fromDate: today,
      toDate: today,
      skip: 0,
      limit: 50,
    }),
  ])

  const present =
    (byStatus.PRESENT ?? 0) + (byStatus.LATE ?? 0) + (byStatus.EARLY_LEAVE ?? 0) + (byStatus.HALF_DAY ?? 0)

  return {
    businessDate: today,
    kpis: {
      presentToday: present,
      absentToday: byStatus.ABSENT ?? 0,
      lateToday: byStatus.LATE ?? 0,
      onLeaveToday: (byStatus.ON_LEAVE ?? 0) + onLeave.total,
      missingClockOut: byStatus.MISSING_CLOCK_OUT ?? 0,
      pendingCorrections,
      pendingLeaveRequests: pendingLeave,
      holidayToday: byStatus.HOLIDAY ?? 0,
    },
    attendanceByStatus: byStatus,
  }
}

export async function workforceCalendar(
  ctx: AccessContext,
  query: {
    organizationId?: string
    fromDate: string
    toDate: string
    employeeId?: string
    view?: 'day' | 'week' | 'month'
  },
) {
  const organizationId = await requireWorkforceOrganization(ctx, query.organizationId)
  const branchIds = branchScopeForList(ctx)
  const [attendance, leave, holidays, schedules] = await Promise.all([
    listAttendance({
      organizationId,
      employeeId: query.employeeId,
      branchIds,
      fromDate: query.fromDate,
      toDate: query.toDate,
      skip: 0,
      limit: 500,
    }),
    listLeaveRequests({
      organizationId,
      employeeId: query.employeeId,
      branchIds,
      fromDate: query.fromDate,
      toDate: query.toDate,
      skip: 0,
      limit: 200,
    }),
    listHolidays({
      organizationId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      skip: 0,
      limit: 100,
    }),
    listAssignments({
      organizationId,
      employeeId: query.employeeId,
      branchIds,
      skip: 0,
      limit: 200,
    }),
  ])

  return {
    view: query.view ?? 'month',
    fromDate: query.fromDate,
    toDate: query.toDate,
    attendance: attendance.items,
    leave: leave.items,
    holidays: holidays.items,
    schedules: schedules.items,
  }
}
