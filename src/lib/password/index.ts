import bcrypt from 'bcrypt'

const ROUNDS = 12

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-safe-placeholder', ROUNDS)

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS)
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash)
}

export function dummyPasswordHash(): string {
  return DUMMY_PASSWORD_HASH
}
