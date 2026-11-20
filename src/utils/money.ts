/**
 * Money is never a JS number. Amounts travel and are stored as decimal strings ("150.00").
 */
export const MONEY_REGEX = /^\d{1,12}(\.\d{1,2})?$/

export function isMoneyString(value: string): boolean {
  return MONEY_REGEX.test(value)
}

/** "150" -> "150.00", "150.5" -> "150.50". Input must already match MONEY_REGEX. */
export function normalizeMoney(value: string): string {
  const [whole = '0', fraction = ''] = value.split('.')
  const trimmed = whole.replace(/^0+(?=\d)/, '')
  return `${trimmed}.${fraction.padEnd(2, '0')}`
}

/** True for "0", "0.0", "0.00". Input must already match MONEY_REGEX. */
export function isZeroMoney(value: string): boolean {
  return /^0+(\.0+)?$/.test(value)
}

function toCents(amount: string): bigint {
  const normalized = normalizeMoney(amount)
  const [whole = '0', fraction = '00'] = normalized.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2))
}

function fromCents(cents: bigint): string {
  const negative = cents < 0n
  const absolute = negative ? -cents : cents
  const frac = (absolute % 100n).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${absolute / 100n}.${frac}`
}

/** Multiplies a money string by a whole quantity. The result is a 2-decimal string, never a float. */
export function multiplyMoney(amount: string, quantity: number): string {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error('quantity must be a non-negative integer')
  }
  return fromCents(toCents(amount) * BigInt(quantity))
}

/** Adds money strings with BigInt cents. */
export function addMoney(...amounts: string[]): string {
  return fromCents(amounts.reduce((sum, amount) => sum + toCents(amount), 0n))
}

/** Subtracts `b` from `a`. Throws if the result would be negative unless `allowNegative` is set. */
export function subtractMoney(a: string, b: string, allowNegative = false): string {
  const result = toCents(a) - toCents(b)
  if (!allowNegative && result < 0n) throw new Error('Money result would be negative')
  return fromCents(result)
}

/** -1 if a < b, 0 if equal, 1 if a > b. */
export function compareMoney(a: string, b: string): -1 | 0 | 1 {
  const left = toCents(a)
  const right = toCents(b)
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/**
 * Applies a percent rate (e.g. "5.00" for 5%) to a money amount.
 * Uses integer cents with half-up rounding to the nearest cent.
 */
export function percentOfMoney(amount: string, ratePercent: string): string {
  const rate = normalizeMoney(ratePercent)
  const [whole = '0', fraction = '00'] = rate.split('.')
  const rateBp = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2))
  const product = toCents(amount) * rateBp
  const rounded = (product + 5000n) / 10000n
  return fromCents(rounded)
}
