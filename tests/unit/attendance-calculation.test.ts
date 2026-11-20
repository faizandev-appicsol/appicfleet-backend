import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { ATTENDANCE_STATUSES } from '../../src/constants/workforce.js'
import { calculateAttendance, minutesToHoursDecimal } from '../../src/services/workforce/attendance-calculation.js'
import {
  resolveBusinessDate,
  scheduledWindowUtc,
  zonedLocalToUtc,
} from '../../src/services/workforce/attendance-timezone.js'

describe('attendance calculation', () => {
  it('applies grace period before late minutes', () => {
    const scheduledStart = new Date('2026-03-10T05:00:00.000Z') // 09:00 Asia/Dubai
    const scheduledEnd = new Date('2026-03-10T14:00:00.000Z')
    const clockIn = new Date(scheduledStart.getTime() + 10 * 60_000)
    const clockOut = scheduledEnd

    const result = calculateAttendance({
      scheduledStart,
      scheduledEnd,
      clockIn,
      clockOut,
      graceMinutes: 15,
    })

    assert.equal(result.lateDurationMinutes, 0)
    assert.equal(result.status, ATTENDANCE_STATUSES.PRESENT)
  })

  it('counts late minutes after grace', () => {
    const scheduledStart = new Date('2026-03-10T05:00:00.000Z')
    const scheduledEnd = new Date('2026-03-10T14:00:00.000Z')
    const clockIn = new Date(scheduledStart.getTime() + 25 * 60_000)
    const clockOut = scheduledEnd

    const result = calculateAttendance({
      scheduledStart,
      scheduledEnd,
      clockIn,
      clockOut,
      graceMinutes: 15,
    })

    assert.equal(result.lateDurationMinutes, 10)
    assert.equal(result.status, ATTENDANCE_STATUSES.LATE)
  })

  it('calculates early leave and overtime', () => {
    const scheduledStart = new Date('2026-03-10T05:00:00.000Z')
    const scheduledEnd = new Date('2026-03-10T14:00:00.000Z')
    const earlyOut = new Date(scheduledEnd.getTime() - 30 * 60_000)
    const lateOut = new Date(scheduledEnd.getTime() + 45 * 60_000)

    const early = calculateAttendance({
      scheduledStart,
      scheduledEnd,
      clockIn: scheduledStart,
      clockOut: earlyOut,
      graceMinutes: 15,
    })
    assert.equal(early.earlyLeaveDurationMinutes, 30)
    assert.equal(early.status, ATTENDANCE_STATUSES.EARLY_LEAVE)

    const ot = calculateAttendance({
      scheduledStart,
      scheduledEnd,
      clockIn: scheduledStart,
      clockOut: lateOut,
      graceMinutes: 15,
    })
    assert.equal(ot.overtimeDurationMinutes, 45)
    assert.equal(minutesToHoursDecimal(45), '0.75')
  })

  it('subtracts break duration from worked time', () => {
    const scheduledStart = new Date('2026-03-10T05:00:00.000Z')
    const scheduledEnd = new Date('2026-03-10T14:00:00.000Z')
    const clockOut = scheduledEnd
    const result = calculateAttendance({
      scheduledStart,
      scheduledEnd,
      clockIn: scheduledStart,
      clockOut,
      breaks: [
        {
          start: new Date(scheduledStart.getTime() + 4 * 60 * 60_000),
          end: new Date(scheduledStart.getTime() + 5 * 60 * 60_000),
        },
      ],
      graceMinutes: 0,
    })
    assert.equal(result.breakDurationMinutes, 60)
    assert.equal(result.workedDurationMinutes, 8 * 60)
  })

  it('marks on leave / holiday / rest day without clock', () => {
    const scheduledStart = new Date('2026-03-10T05:00:00.000Z')
    const scheduledEnd = new Date('2026-03-10T14:00:00.000Z')
    assert.equal(
      calculateAttendance({ scheduledStart, scheduledEnd, onLeave: true }).status,
      ATTENDANCE_STATUSES.ON_LEAVE,
    )
    assert.equal(
      calculateAttendance({ scheduledStart, scheduledEnd, isHoliday: true }).status,
      ATTENDANCE_STATUSES.HOLIDAY,
    )
    assert.equal(
      calculateAttendance({ scheduledStart, scheduledEnd, isRestDay: true }).status,
      ATTENDANCE_STATUSES.REST_DAY,
    )
  })

  it('flags missing clock-out after clock-in', () => {
    const scheduledStart = new Date('2026-03-10T05:00:00.000Z')
    const scheduledEnd = new Date('2026-03-10T14:00:00.000Z')
    const result = calculateAttendance({
      scheduledStart,
      scheduledEnd,
      clockIn: scheduledStart,
      graceMinutes: 15,
    })
    assert.equal(result.status, ATTENDANCE_STATUSES.MISSING_CLOCK_OUT)
  })
})

describe('overnight shift business date', () => {
  const timeZone = 'Asia/Dubai'

  it('builds a window that crosses midnight', () => {
    const window = scheduledWindowUtc({
      businessDate: '2026-11-10',
      startTime: '22:00',
      endTime: '07:00',
      timeZone,
    })
    assert.equal(window.crossesMidnight, true)
    assert.ok(window.scheduledEnd.getTime() > window.scheduledStart.getTime())
    assert.equal(
      window.scheduledEnd.getTime() - window.scheduledStart.getTime(),
      9 * 60 * 60_000,
    )
  })

  it('assigns early-morning clocks to previous business date', () => {
    const at = zonedLocalToUtc('2026-11-11', '01:30', timeZone)
    const businessDate = resolveBusinessDate({
      at,
      timeZone,
      startTime: '22:00',
      endTime: '07:00',
    })
    assert.equal(businessDate, '2026-11-10')
  })

  it('keeps late-evening clocks on start business date', () => {
    const at = zonedLocalToUtc('2026-11-10', '22:15', timeZone)
    const businessDate = resolveBusinessDate({
      at,
      timeZone,
      startTime: '22:00',
      endTime: '07:00',
    })
    assert.equal(businessDate, '2026-11-10')
  })
})
