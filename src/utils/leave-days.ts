/**
 * Leave balances use decimal day strings ("2.00"), never JS floats.
 * Precision is hundredths of a day (same pattern as money cents).
 */
export const LEAVE_DAYS_REGEX = /^\d{1,5}(\.\d{1,2})?$/

export function isLeaveDaysString(value: string): boolean {
  return LEAVE_DAYS_REGEX.test(value)
}

export function normalizeLeaveDays(value: string): string {
  const [whole = '0', fraction = ''] = value.split('.')
  const trimmed = whole.replace(/^0+(?=\d)/, '') || '0'
  return `${trimmed}.${fraction.padEnd(2, '0')}`
}

function toHundredths(amount: string): bigint {
  const normalized = normalizeLeaveDays(amount)
  const [whole = '0', fraction = '00'] = normalized.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2))
}

function fromHundredths(value: bigint): string {
  const negative = value < 0n
  const absolute = negative ? -value : value
  const frac = (absolute % 100n).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${absolute / 100n}.${frac}`
}

export function addLeaveDays(...amounts: string[]): string {
  return fromHundredths(amounts.reduce((sum, amount) => sum + toHundredths(amount), 0n))
}

export function subtractLeaveDays(a: string, b: string, allowNegative = false): string {
  const result = toHundredths(a) - toHundredths(b)
  if (!allowNegative && result < 0n) throw new Error('Leave balance would be negative')
  return fromHundredths(result)
}

export function compareLeaveDays(a: string, b: string): -1 | 0 | 1 {
  const left = toHundredths(a)
  const right = toHundredths(b)
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/** Divide annual entitlement by period count (e.g. 24 / 12). Half-up to hundredths. */
export function divideLeaveDays(amount: string, divisor: number): string {
  if (!Number.isInteger(divisor) || divisor <= 0) {
    throw new Error('divisor must be a positive integer')
  }
  const product = toHundredths(amount)
  const rounded = (product + BigInt(Math.floor(divisor / 2))) / BigInt(divisor)
  return fromHundredths(rounded)
}

export function minLeaveDays(a: string, b: string): string {
  return compareLeaveDays(a, b) <= 0 ? normalizeLeaveDays(a) : normalizeLeaveDays(b)
}

export function isZeroLeaveDays(value: string): boolean {
  return /^0+(\.0+)?$/.test(value)
}
