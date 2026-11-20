import {
  REPORT_DATE_PRESETS,
  UPCOMING_RETURN_WINDOWS,
  type ReportDatePreset,
  type UpcomingReturnWindow,
} from '../../constants/reporting.js'
import { invalidField } from '../../utils/httpErrors.js'

/**
 * Date strategy (Module 13):
 * - Filters are interpreted as UTC calendar days unless a timezone is supplied.
 * - Ranges are half-open: [from, toExclusive).
 * - Organization timezone may be passed for preset calculation; default UTC.
 */
export type DateRange = { from: Date; toExclusive: Date; preset: ReportDatePreset; timezone: string }

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function resolveReportDateRange(input: {
  preset?: string
  from?: Date
  to?: Date
  timezone?: string
  now?: Date
}): DateRange {
  const timezone = input.timezone?.trim() || 'UTC'
  const now = input.now ?? new Date()
  const today = startOfUtcDay(now)
  const preset = (input.preset?.toUpperCase() || REPORT_DATE_PRESETS.THIS_MONTH) as ReportDatePreset

  if (preset === REPORT_DATE_PRESETS.CUSTOM) {
    if (!input.from || !input.to) throw invalidField('from', 'Custom range requires from and to.')
    if (input.to <= input.from) throw invalidField('to', 'to must be after from.')
    return { from: input.from, toExclusive: input.to, preset, timezone }
  }

  switch (preset) {
    case REPORT_DATE_PRESETS.TODAY:
      return { from: today, toExclusive: addUtcDays(today, 1), preset, timezone }
    case REPORT_DATE_PRESETS.YESTERDAY: {
      const from = addUtcDays(today, -1)
      return { from, toExclusive: today, preset, timezone }
    }
    case REPORT_DATE_PRESETS.THIS_WEEK: {
      const day = today.getUTCDay() || 7
      const from = addUtcDays(today, 1 - day)
      return { from, toExclusive: addUtcDays(from, 7), preset, timezone }
    }
    case REPORT_DATE_PRESETS.LAST_WEEK: {
      const day = today.getUTCDay() || 7
      const thisWeekStart = addUtcDays(today, 1 - day)
      const from = addUtcDays(thisWeekStart, -7)
      return { from, toExclusive: thisWeekStart, preset, timezone }
    }
    case REPORT_DATE_PRESETS.THIS_MONTH: {
      const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
      const toExclusive = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1))
      return { from, toExclusive, preset, timezone }
    }
    case REPORT_DATE_PRESETS.LAST_MONTH: {
      const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
      const toExclusive = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
      return { from, toExclusive, preset, timezone }
    }
    case REPORT_DATE_PRESETS.THIS_QUARTER: {
      const quarter = Math.floor(today.getUTCMonth() / 3)
      const from = new Date(Date.UTC(today.getUTCFullYear(), quarter * 3, 1))
      const toExclusive = new Date(Date.UTC(today.getUTCFullYear(), quarter * 3 + 3, 1))
      return { from, toExclusive, preset, timezone }
    }
    case REPORT_DATE_PRESETS.THIS_YEAR: {
      const from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1))
      const toExclusive = new Date(Date.UTC(today.getUTCFullYear() + 1, 0, 1))
      return { from, toExclusive, preset, timezone }
    }
    default:
      throw invalidField('preset', 'Unsupported date preset.')
  }
}

export function previousPeriod(range: DateRange): DateRange {
  const durationMs = range.toExclusive.getTime() - range.from.getTime()
  return {
    from: new Date(range.from.getTime() - durationMs),
    toExclusive: new Date(range.from.getTime()),
    preset: REPORT_DATE_PRESETS.CUSTOM,
    timezone: range.timezone,
  }
}

export function resolveUpcomingWindow(window: string | undefined, now = new Date()): { from: Date; toExclusive: Date } {
  const key = (window?.toUpperCase() || UPCOMING_RETURN_WINDOWS.NEXT_7_DAYS) as UpcomingReturnWindow
  const from = now
  switch (key) {
    case UPCOMING_RETURN_WINDOWS.TODAY: {
      const start = startOfUtcDay(now)
      return { from: now < start ? start : now, toExclusive: addUtcDays(start, 1) }
    }
    case UPCOMING_RETURN_WINDOWS.NEXT_24H:
      return { from, toExclusive: new Date(now.getTime() + 24 * 60 * 60 * 1000) }
    case UPCOMING_RETURN_WINDOWS.NEXT_3_DAYS:
      return { from, toExclusive: addUtcDays(startOfUtcDay(now), 3) }
    case UPCOMING_RETURN_WINDOWS.NEXT_7_DAYS:
    default:
      return { from, toExclusive: addUtcDays(startOfUtcDay(now), 7) }
  }
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 10000) / 100
}
