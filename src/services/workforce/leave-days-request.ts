import { LEAVE_DAY_PARTS } from '../../constants/workforce.js'
import { invalidField } from '../../utils/httpErrors.js'
import { normalizeLeaveDays } from '../../utils/leave-days.js'
import { addCalendarDays } from './attendance-timezone.js'

function daysBetweenInclusive(start: string, end: string): number {
  let n = 0
  let cur = start
  while (cur <= end) {
    n += 1
    cur = addCalendarDays(cur, 1)
    if (n > 400) break
  }
  return n
}

export function computeLeaveDaysRequested(input: {
  startDate: string
  endDate: string
  dayPart: string
  partialHours?: string
}): string {
  if (input.startDate > input.endDate) {
    throw invalidField('endDate', 'End date must be on or after start date.')
  }
  if (input.dayPart === LEAVE_DAY_PARTS.FULL_DAY) {
    return normalizeLeaveDays(String(daysBetweenInclusive(input.startDate, input.endDate)))
  }
  if (
    input.dayPart === LEAVE_DAY_PARTS.HALF_DAY_AM ||
    input.dayPart === LEAVE_DAY_PARTS.HALF_DAY_PM
  ) {
    if (input.startDate !== input.endDate) {
      throw invalidField('dayPart', 'Half-day leave must be a single calendar day.')
    }
    return '0.50'
  }
  if (input.dayPart === LEAVE_DAY_PARTS.PARTIAL_HOURS) {
    if (input.startDate !== input.endDate) {
      throw invalidField('dayPart', 'Partial-hours leave must be a single calendar day.')
    }
    const hours = Number(input.partialHours ?? 0)
    if (!Number.isFinite(hours) || hours <= 0 || hours > 12) {
      throw invalidField('partialHours', 'Partial hours must be between 0 and 12.')
    }
    const hundredths = Math.round((hours / 8) * 100)
    return normalizeLeaveDays(
      `${Math.floor(hundredths / 100)}.${(hundredths % 100).toString().padStart(2, '0')}`,
    )
  }
  throw invalidField('dayPart', 'Invalid leave day part.')
}
