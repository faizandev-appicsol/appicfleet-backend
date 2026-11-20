import { COMPLIANCE_STATES, type ComplianceState } from '../../constants/vehicles.js'

/** A date inside this many days (inclusive) of today is "expiring". */
export const COMPLIANCE_SOON_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

export type ComplianceDates = {
  registrationExpiresOn?: Date | null
  insuranceExpiresOn?: Date | null
  inspectionExpiresOn?: Date | null
}

export type ComplianceEvaluation = {
  registration: ComplianceState
  insurance: ComplianceState
  inspection: ComplianceState
  overall: ComplianceState
}

function utcDay(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS)
}

/**
 * Expiry dates are calendar days (UTC). A document is valid through its expiry day, so it is
 * "expiring" on the day itself and "expired" from the day after.
 */
export function evaluateDate(expiresOn: Date | null | undefined, now: Date): ComplianceState {
  if (!expiresOn) return COMPLIANCE_STATES.MISSING
  const daysLeft = utcDay(expiresOn) - utcDay(now)
  if (daysLeft < 0) return COMPLIANCE_STATES.EXPIRED
  if (daysLeft <= COMPLIANCE_SOON_DAYS) return COMPLIANCE_STATES.EXPIRING
  return COMPLIANCE_STATES.VALID
}

/** Higher number = worse. expired > expiring > missing > valid. */
const SEVERITY: Record<ComplianceState, number> = {
  [COMPLIANCE_STATES.VALID]: 0,
  [COMPLIANCE_STATES.MISSING]: 1,
  [COMPLIANCE_STATES.EXPIRING]: 2,
  [COMPLIANCE_STATES.EXPIRED]: 3,
}

export function worstState(states: readonly ComplianceState[]): ComplianceState {
  let worst: ComplianceState = COMPLIANCE_STATES.VALID
  for (const state of states) {
    if (SEVERITY[state] > SEVERITY[worst]) worst = state
  }
  return worst
}

export function evaluateCompliance(dates: ComplianceDates, now: Date): ComplianceEvaluation {
  const registration = evaluateDate(dates.registrationExpiresOn, now)
  const insurance = evaluateDate(dates.insuranceExpiresOn, now)
  const inspection = evaluateDate(dates.inspectionExpiresOn, now)
  return {
    registration,
    insurance,
    inspection,
    overall: worstState([registration, insurance, inspection]),
  }
}
