import { WEIGHT_TOTAL } from '../../constants/performance.js'
import { conflict, invalidField } from '../../utils/httpErrors.js'

/** Decimal weights as strings with 2 places (e.g. "40.00"). Never use JS float for totals. */
function toHundredths(value: string): bigint {
  const trimmed = value.trim()
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(trimmed)) {
    throw invalidField('weight', 'Weight must be a decimal string such as 40.00.')
  }
  const [whole = '0', fraction = ''] = trimmed.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2))
}

function fromHundredths(value: bigint): string {
  const whole = value / 100n
  const frac = (value % 100n).toString().padStart(2, '0')
  return `${whole}.${frac}`
}

export function sumWeights(weights: string[]): string {
  let total = 0n
  for (const w of weights) total += toHundredths(w)
  return fromHundredths(total)
}

export function assertGoalWeightsTotal100(weights: string[], required = true) {
  if (!required || weights.length === 0) return
  const total = sumWeights(weights)
  if (total !== WEIGHT_TOTAL) {
    throw conflict(`Goal weights must total ${WEIGHT_TOTAL}. Current total is ${total}.`)
  }
}

/** Weighted average of ratings using weight strings. Returns 2-decimal string. */
export function weightedAverage(items: Array<{ rating: number; weight: string }>): string {
  if (items.length === 0) return '0.00'
  let weightedSum = 0n
  let weightTotal = 0n
  for (const item of items) {
    if (!Number.isFinite(item.rating)) continue
    const w = toHundredths(item.weight)
    weightTotal += w
    // rating * 100 (to hundredths of a rating point) * weight-hundredths
    weightedSum += BigInt(Math.round(item.rating * 100)) * w
  }
  if (weightTotal === 0n) return '0.00'
  const result = weightedSum / weightTotal
  return fromHundredths(result)
}

export function computeNumericProgress(
  targetValue: string | undefined,
  currentValue: string | undefined,
): string | null {
  if (!targetValue || !currentValue) return null
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(targetValue) || !/^\d{1,12}(\.\d{1,2})?$/.test(currentValue)) {
    return null
  }
  const target = toHundredths(targetValue.includes('.') ? targetValue : `${targetValue}.00`)
  if (target === 0n) return null
  const current = toHundredths(currentValue.includes('.') ? currentValue : `${currentValue}.00`)
  // progress = current/target * 100, capped at 100.00 in hundredths of percent
  const pct = (current * 10000n) / target
  const capped = pct > 10000n ? 10000n : pct
  return fromHundredths(capped)
}
