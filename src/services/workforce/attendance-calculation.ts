import {
  ATTENDANCE_STATUSES,
  DEFAULT_GRACE_MINUTES,
  type AttendanceStatus,
} from '../../constants/workforce.js'

export type BreakWindow = {
  start: Date
  end: Date
  type?: string
}

export type AttendanceCalcInput = {
  scheduledStart: Date
  scheduledEnd: Date
  clockIn?: Date | null
  clockOut?: Date | null
  breaks?: BreakWindow[]
  graceMinutes?: number
  onLeave?: boolean
  isHoliday?: boolean
  isRestDay?: boolean
}

export type AttendanceCalcResult = {
  scheduledDurationMinutes: number
  breakDurationMinutes: number
  workedDurationMinutes: number
  lateDurationMinutes: number
  earlyLeaveDurationMinutes: number
  overtimeDurationMinutes: number
  status: AttendanceStatus
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60_000))
}

function clampBreak(breakStart: Date, breakEnd: Date, windowStart: Date, windowEnd: Date): number {
  const start = Math.max(breakStart.getTime(), windowStart.getTime())
  const end = Math.min(breakEnd.getTime(), windowEnd.getTime())
  if (end <= start) return 0
  return Math.floor((end - start) / 60_000)
}

/**
 * Deterministic attendance duration calculator.
 * Durations are whole minutes derived from UTC instants (already timezone-resolved).
 */
export function calculateAttendance(input: AttendanceCalcInput): AttendanceCalcResult {
  const grace = input.graceMinutes ?? DEFAULT_GRACE_MINUTES
  const scheduledDurationMinutes = minutesBetween(input.scheduledStart, input.scheduledEnd)

  if (input.onLeave) {
    return {
      scheduledDurationMinutes,
      breakDurationMinutes: 0,
      workedDurationMinutes: 0,
      lateDurationMinutes: 0,
      earlyLeaveDurationMinutes: 0,
      overtimeDurationMinutes: 0,
      status: ATTENDANCE_STATUSES.ON_LEAVE,
    }
  }

  if (input.isHoliday && !input.clockIn) {
    return {
      scheduledDurationMinutes,
      breakDurationMinutes: 0,
      workedDurationMinutes: 0,
      lateDurationMinutes: 0,
      earlyLeaveDurationMinutes: 0,
      overtimeDurationMinutes: 0,
      status: ATTENDANCE_STATUSES.HOLIDAY,
    }
  }

  if (input.isRestDay && !input.clockIn) {
    return {
      scheduledDurationMinutes,
      breakDurationMinutes: 0,
      workedDurationMinutes: 0,
      lateDurationMinutes: 0,
      earlyLeaveDurationMinutes: 0,
      overtimeDurationMinutes: 0,
      status: ATTENDANCE_STATUSES.REST_DAY,
    }
  }

  if (!input.clockIn && !input.clockOut) {
    return {
      scheduledDurationMinutes,
      breakDurationMinutes: 0,
      workedDurationMinutes: 0,
      lateDurationMinutes: 0,
      earlyLeaveDurationMinutes: 0,
      overtimeDurationMinutes: 0,
      status: ATTENDANCE_STATUSES.ABSENT,
    }
  }

  if (!input.clockIn && input.clockOut) {
    return {
      scheduledDurationMinutes,
      breakDurationMinutes: 0,
      workedDurationMinutes: 0,
      lateDurationMinutes: 0,
      earlyLeaveDurationMinutes: 0,
      overtimeDurationMinutes: 0,
      status: ATTENDANCE_STATUSES.MISSING_CLOCK_IN,
    }
  }

  const clockIn = input.clockIn!
  const lateRaw = minutesBetween(input.scheduledStart, clockIn)
  const lateDurationMinutes = Math.max(0, lateRaw - grace)

  if (!input.clockOut) {
    return {
      scheduledDurationMinutes,
      breakDurationMinutes: 0,
      workedDurationMinutes: 0,
      lateDurationMinutes,
      earlyLeaveDurationMinutes: 0,
      overtimeDurationMinutes: 0,
      status:
        lateDurationMinutes > 0 ? ATTENDANCE_STATUSES.LATE : ATTENDANCE_STATUSES.MISSING_CLOCK_OUT,
    }
  }

  const clockOut = input.clockOut
  const breakDurationMinutes = (input.breaks ?? []).reduce(
    (sum, b) => sum + clampBreak(b.start, b.end, clockIn, clockOut),
    0,
  )
  const rawWorked = minutesBetween(clockIn, clockOut)
  const workedDurationMinutes = Math.max(0, rawWorked - breakDurationMinutes)
  const earlyLeaveDurationMinutes =
    clockOut.getTime() < input.scheduledEnd.getTime()
      ? minutesBetween(clockOut, input.scheduledEnd)
      : 0
  const overtimeDurationMinutes =
    clockOut.getTime() > input.scheduledEnd.getTime()
      ? minutesBetween(input.scheduledEnd, clockOut)
      : 0

  let status: AttendanceStatus = ATTENDANCE_STATUSES.PRESENT
  if (lateDurationMinutes > 0 && earlyLeaveDurationMinutes > 0) {
    status = ATTENDANCE_STATUSES.HALF_DAY
  } else if (lateDurationMinutes > 0) {
    status = ATTENDANCE_STATUSES.LATE
  } else if (earlyLeaveDurationMinutes > 0) {
    status = ATTENDANCE_STATUSES.EARLY_LEAVE
  }

  // Half-day heuristic: worked less than half scheduled after grace.
  if (workedDurationMinutes > 0 && workedDurationMinutes < Math.floor(scheduledDurationMinutes / 2)) {
    status = ATTENDANCE_STATUSES.HALF_DAY
  }

  return {
    scheduledDurationMinutes,
    breakDurationMinutes,
    workedDurationMinutes,
    lateDurationMinutes,
    earlyLeaveDurationMinutes,
    overtimeDurationMinutes,
    status,
  }
}

export function minutesToHoursDecimal(minutes: number): string {
  const whole = Math.floor(minutes / 60)
  const frac = Math.round(((minutes % 60) / 60) * 100)
  if (frac === 100) return `${whole + 1}.00`
  return `${whole}.${frac.toString().padStart(2, '0')}`
}
