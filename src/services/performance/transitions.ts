import {
  CYCLE_TRANSITIONS,
  REVIEW_TRANSITIONS,
  type CycleStatus,
  type ReviewStatus,
} from '../../constants/performance.js'
import { conflict } from '../../utils/httpErrors.js'

export function assertCycleTransition(from: string, to: string) {
  const allowed = CYCLE_TRANSITIONS[from as CycleStatus] ?? []
  if (!allowed.includes(to as CycleStatus)) {
    throw conflict(`Performance cycle cannot move from ${from} to ${to}.`)
  }
}

export function assertReviewTransition(from: string, to: string) {
  const allowed = REVIEW_TRANSITIONS[from as ReviewStatus] ?? []
  if (!allowed.includes(to as ReviewStatus)) {
    throw conflict(`Performance review cannot move from ${from} to ${to}.`)
  }
}
