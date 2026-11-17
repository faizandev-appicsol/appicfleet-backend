const MULTIPLIERS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
}

export function parseDurationSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim())
  const amountText = match?.[1]
  const unit = match?.[2]
  const multiplier = unit ? MULTIPLIERS[unit] : undefined

  if (!amountText || !multiplier) {
    throw new Error(`Invalid duration "${value}". Use a value like 15m, 7d, or 30s.`)
  }

  const amount = Number(amountText)
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`Invalid duration "${value}". Use a value like 15m, 7d, or 30s.`)
  }

  return amount * multiplier
}
