import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { REPORT_DATE_PRESETS } from '../../src/constants/reporting.js'
import {
  percentChange,
  previousPeriod,
  resolveReportDateRange,
  resolveUpcomingWindow,
} from '../../src/services/reporting/date-range.js'

describe('reporting date range', () => {
  const now = new Date('2026-11-19T12:00:00.000Z')

  it('resolves this month as half-open UTC range', () => {
    const range = resolveReportDateRange({ preset: REPORT_DATE_PRESETS.THIS_MONTH, now })
    assert.equal(range.from.toISOString(), '2026-11-01T00:00:00.000Z')
    assert.equal(range.toExclusive.toISOString(), '2026-12-01T00:00:00.000Z')
  })

  it('resolves today and yesterday', () => {
    const today = resolveReportDateRange({ preset: REPORT_DATE_PRESETS.TODAY, now })
    assert.equal(today.from.toISOString(), '2026-11-19T00:00:00.000Z')
    assert.equal(today.toExclusive.toISOString(), '2026-11-20T00:00:00.000Z')

    const yesterday = resolveReportDateRange({ preset: REPORT_DATE_PRESETS.YESTERDAY, now })
    assert.equal(yesterday.from.toISOString(), '2026-11-18T00:00:00.000Z')
    assert.equal(yesterday.toExclusive.toISOString(), '2026-11-19T00:00:00.000Z')
  })

  it('builds previous period of equal length', () => {
    const range = resolveReportDateRange({ preset: REPORT_DATE_PRESETS.THIS_MONTH, now })
    const prev = previousPeriod(range)
    assert.equal(prev.toExclusive.toISOString(), range.from.toISOString())
    assert.equal(prev.toExclusive.getTime() - prev.from.getTime(), range.toExclusive.getTime() - range.from.getTime())
  })

  it('computes percent change', () => {
    assert.equal(percentChange(110, 100), 10)
    assert.equal(percentChange(0, 0), 0)
    assert.equal(percentChange(50, 0), null)
  })

  it('resolves upcoming return windows', () => {
    const next24 = resolveUpcomingWindow('NEXT_24H', now)
    assert.equal(next24.toExclusive.toISOString(), '2026-11-20T12:00:00.000Z')
  })
})
