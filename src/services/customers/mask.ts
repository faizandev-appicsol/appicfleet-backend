/** Keys whose values are identity numbers and must be masked unless revealed. */
export const SENSITIVE_KEY_PATTERN = /number|id|passport|license|tax/i

/**
 * Pure masking: keeps the first 2 and last 2 characters of a value longer than 6 characters,
 * and replaces everything else with `****`.
 */
export function maskSensitive(value: string): string {
  if (value.length > 6) {
    return `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`
  }
  return '****'
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key)
}

/** Masks the value when its key looks like an identity number, unless `reveal` is true. */
export function maskByKey(key: string, value: string, reveal: boolean): string {
  return !reveal && isSensitiveKey(key) ? maskSensitive(value) : value
}

/** Masks an always-sensitive value (license, tax or registration number) unless `reveal` is true. */
export function maskValue(value: string | undefined, reveal: boolean): string | undefined {
  if (value === undefined) return undefined
  return reveal ? value : maskSensitive(value)
}
