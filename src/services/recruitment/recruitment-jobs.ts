import { registerJob } from '../jobs/scheduler.js'
import { expireDueOffers } from './offer.service.js'

const INTERVAL_MS = 5 * 60_000

/** Offer expiry and related recruitment maintenance jobs. */
export function registerRecruitmentJobs(): void {
  registerJob({
    name: 'recruitment-offer-expiry',
    intervalMs: INTERVAL_MS,
    run: async () => {
      await expireDueOffers()
    },
  })
}
