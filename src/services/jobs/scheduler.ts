import { logger } from '../../lib/logger/index.js'

export type ScheduledJob = {
  name: string
  intervalMs: number
  run: () => Promise<void>
}

const jobs: ScheduledJob[] = []
let started = false

/** Registers a repeating job. Call this before `startScheduler`. */
export function registerJob(job: ScheduledJob): void {
  if (jobs.some((existing) => existing.name === job.name)) return
  jobs.push(job)
}

/**
 * Starts every registered job once, then on its interval.
 * Safe to call twice. There is no second queue framework: this is the only scheduler.
 */
export function startScheduler(): void {
  if (started) return
  started = true
  for (const job of jobs) {
    const tick = () => {
      void job.run().catch((error: unknown) => {
        logger.warn('Scheduled job failed', {
          module: 'jobs',
          job: job.name,
          name: error instanceof Error ? error.name : 'Error',
        })
      })
    }
    tick()
    setInterval(tick, job.intervalMs).unref()
  }
}
