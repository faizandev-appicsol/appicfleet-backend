import { createHash, timingSafeEqual } from 'node:crypto'

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function tokenHashesMatch(storedHash: string, presentedHash: string): boolean {
  const left = Buffer.from(storedHash)
  const right = Buffer.from(presentedHash)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
