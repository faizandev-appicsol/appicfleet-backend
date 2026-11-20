/**
 * Attendance timezone strategy (Module 18):
 *
 * 1. Prefer schedule/shift timezone when assigned.
 * 2. Else branch.timezone (branches always have a timezone).
 * 3. Else DEFAULT_WORKFORCE_TIMEZONE.
 *
 * All clock timestamps are stored as UTC Date instants.
 * Business date, scheduled windows, lateness, and overnight boundaries
 * are computed in the resolved timezone — never from raw server local time.
 */
import { DEFAULT_WORKFORCE_TIMEZONE, WEEKDAY_CODES, type WeekdayCode } from '../../constants/workforce.js'

const WEEKDAY_BY_UTC_DAY: WeekdayCode[] = [
  WEEKDAY_CODES.SUN,
  WEEKDAY_CODES.MON,
  WEEKDAY_CODES.TUE,
  WEEKDAY_CODES.WED,
  WEEKDAY_CODES.THU,
  WEEKDAY_CODES.FRI,
  WEEKDAY_CODES.SAT,
]

export function resolveAttendanceTimezone(input: {
  scheduleTimezone?: string | null
  shiftTimezone?: string | null
  branchTimezone?: string | null
}): string {
  return (
    input.scheduleTimezone?.trim() ||
    input.shiftTimezone?.trim() ||
    input.branchTimezone?.trim() ||
    DEFAULT_WORKFORCE_TIMEZONE
  )
}

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: WeekdayCode
  ymd: string
}

function parseParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  })
  const bag: Record<string, string> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') bag[part.type] = part.value
  }
  const weekdayMap: Record<string, WeekdayCode> = {
    Mon: WEEKDAY_CODES.MON,
    Tue: WEEKDAY_CODES.TUE,
    Wed: WEEKDAY_CODES.WED,
    Thu: WEEKDAY_CODES.THU,
    Fri: WEEKDAY_CODES.FRI,
    Sat: WEEKDAY_CODES.SAT,
    Sun: WEEKDAY_CODES.SUN,
  }
  const year = Number(bag.year)
  const month = Number(bag.month)
  const day = Number(bag.day)
  return {
    year,
    month,
    day,
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
    weekday: weekdayMap[bag.weekday ?? ''] ?? WEEKDAY_BY_UTC_DAY[date.getUTCDay()]!,
    ymd: `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
      .toString()
      .padStart(2, '0')}`,
  }
}

export function getZonedYmd(date: Date, timeZone: string): string {
  return parseParts(date, timeZone).ymd
}

export function getZonedWeekday(date: Date, timeZone: string): WeekdayCode {
  return parseParts(date, timeZone).weekday
}

/** Convert a calendar date (YYYY-MM-DD) + HH:mm in `timeZone` to a UTC Date. */
export function zonedLocalToUtc(ymd: string, hm: string, timeZone: string): Date {
  const [year, month, day] = ymd.split('-').map(Number)
  const [hour, minute] = hm.split(':').map(Number)
  if (!year || !month || !day || hour === undefined || minute === undefined) {
    throw new Error('Invalid date or time')
  }

  // Initial guess: treat components as UTC, then correct by observed offset.
  let utcMillis = Date.UTC(year, month - 1, day, hour, minute, 0)
  for (let i = 0; i < 3; i += 1) {
    const parts = parseParts(new Date(utcMillis), timeZone)
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0)
    utcMillis += desired - asUtc
  }
  return new Date(utcMillis)
}

export function addCalendarDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days))
  return `${dt.getUTCFullYear().toString().padStart(4, '0')}-${(dt.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}-${dt.getUTCDate().toString().padStart(2, '0')}`
}

export function parseHmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h! * 60 + m!
}

/**
 * Build scheduled start/end UTC instants for a business date.
 * Overnight shifts (end <= start) end on the next calendar day in the timezone.
 */
export function scheduledWindowUtc(input: {
  businessDate: string
  startTime: string
  endTime: string
  timeZone: string
}): { scheduledStart: Date; scheduledEnd: Date; crossesMidnight: boolean } {
  const startMinutes = parseHmToMinutes(input.startTime)
  const endMinutes = parseHmToMinutes(input.endTime)
  const crossesMidnight = endMinutes <= startMinutes
  const endDate = crossesMidnight ? addCalendarDays(input.businessDate, 1) : input.businessDate
  return {
    scheduledStart: zonedLocalToUtc(input.businessDate, input.startTime, input.timeZone),
    scheduledEnd: zonedLocalToUtc(endDate, input.endTime, input.timeZone),
    crossesMidnight,
  }
}

/**
 * Resolve business date for a clock event.
 * For overnight shifts, clocks before scheduled end on the next calendar day
 * still belong to the shift's start date.
 */
export function resolveBusinessDate(input: {
  at: Date
  timeZone: string
  startTime?: string
  endTime?: string
}): string {
  const parts = parseParts(input.at, input.timeZone)
  if (!input.startTime || !input.endTime) return parts.ymd

  const startMinutes = parseHmToMinutes(input.startTime)
  const endMinutes = parseHmToMinutes(input.endTime)
  if (endMinutes > startMinutes) return parts.ymd

  // Overnight: early-morning clock-ins (before end) belong to previous calendar day.
  const clockMinutes = parts.hour * 60 + parts.minute
  if (clockMinutes < endMinutes) {
    return addCalendarDays(parts.ymd, -1)
  }
  return parts.ymd
}
