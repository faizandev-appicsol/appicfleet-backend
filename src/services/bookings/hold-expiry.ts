import { registerJob } from '../jobs/scheduler.js'
import { expireDueHolds } from './booking.service.js'

const INTERVAL_MS = 60_000

/** Expired holds are released on this interval and by POST /bookings/holds/expire. */
export function registerBookingJobs(): void {
  registerJob({
    name: 'booking-hold-expiry',
    intervalMs: INTERVAL_MS,
    run: async () => {
      await expireDueHolds()
    },
  })
}
