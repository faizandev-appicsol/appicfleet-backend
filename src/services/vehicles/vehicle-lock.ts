import { randomUUID } from 'node:crypto'
import { conflict } from '../../utils/httpErrors.js'

/** How long a lock is held before another caller may take it over (crashed holder safety net). */
export const VEHICLE_LOCK_TTL_MS = 15_000

export const VEHICLE_LOCK_BUSY_MESSAGE = 'Vehicle is being updated. Retry.'

/**
 * Storage port for the per-vehicle mutex. The Mongo implementation lives in
 * `repositories/vehicles/vehicle-lock.repository.ts`; tests use an in-memory fake.
 */
export type VehicleLockStore = {
  /**
   * Atomically takes the lock when no live lock exists (no document, or lockedUntil < now).
   * Resolves true only when this caller's token now owns the lock.
   */
  acquire(vehicleId: string, token: string, now: Date, lockedUntil: Date): Promise<boolean>
  /** Releases the lock only if the token still owns it. */
  release(vehicleId: string, token: string, now: Date): Promise<void>
}

export type LockOptions = {
  ttlMs?: number
  now?: () => Date
  newToken?: () => string
}

/**
 * Runs `fn` while holding the vehicle's mutex. Concurrent callers fail fast with 409 instead of
 * waiting. Needs no multi-document transactions, so it is safe on a standalone MongoDB.
 */
export async function runWithVehicleLock<T>(
  store: VehicleLockStore,
  vehicleId: string,
  fn: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const now = options.now ?? (() => new Date())
  const token = (options.newToken ?? randomUUID)()
  const acquiredAt = now()
  const lockedUntil = new Date(acquiredAt.getTime() + (options.ttlMs ?? VEHICLE_LOCK_TTL_MS))

  const acquired = await store.acquire(vehicleId, token, acquiredAt, lockedUntil)
  if (!acquired) throw conflict(VEHICLE_LOCK_BUSY_MESSAGE)

  try {
    return await fn()
  } finally {
    try {
      await store.release(vehicleId, token, now())
    } catch {
      // A failed release must not mask the outcome of fn; the lock expires on its own (TTL).
    }
  }
}
