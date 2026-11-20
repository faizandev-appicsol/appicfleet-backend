import { ANALYTICS_PRIVACY_THRESHOLD } from '../../constants/performance.js'
import {
  countByStatus,
  listFeedback,
  listOneOnOnes,
  listRecognitions,
  ratingDistribution,
} from '../../repositories/performance/performance.repository.js'
import type { AccessContext } from '../../types/access.js'
import { branchScopeForList, requirePerformanceOrganization } from './performance-access.js'

export async function performanceDashboard(
  ctx: AccessContext,
  query: { organizationId?: string; cycleId?: string },
) {
  const organizationId = await requirePerformanceOrganization(ctx, query.organizationId)
  const branchIds = branchScopeForList(ctx)

  const [cycles, reviews, goals, pips, development] = await Promise.all([
    countByStatus('performance_cycles', organizationId),
    countByStatus('performance_reviews', organizationId, branchIds),
    countByStatus('employee_goals', organizationId, branchIds),
    countByStatus('performance_improvement_plans', organizationId, branchIds),
    countByStatus('development_plans', organizationId),
  ])

  const reviewTotal = Object.values(reviews).reduce((a, b) => a + b, 0)
  const completed =
    (reviews.COMPLETED ?? 0) + (reviews.APPROVED ?? 0)
  const pending =
    (reviews.DRAFT ?? 0) +
    (reviews.SELF_REVIEW ?? 0) +
    (reviews.MANAGER_REVIEW ?? 0) +
    (reviews.PEER_REVIEW ?? 0) +
    (reviews.CALIBRATION ?? 0) +
    (reviews.FINAL_REVIEW ?? 0)

  return {
    kpis: {
      openCycles:
        (cycles.OPEN ?? 0) +
        (cycles.SELF_REVIEW ?? 0) +
        (cycles.MANAGER_REVIEW ?? 0) +
        (cycles.PEER_REVIEW ?? 0) +
        (cycles.CALIBRATION ?? 0) +
        (cycles.FINALIZATION ?? 0),
      reviewsTotal: reviewTotal,
      reviewsCompleted: completed,
      reviewsPending: pending,
      completionPercent:
        reviewTotal === 0 ? null : Math.round((completed / reviewTotal) * 10000) / 100,
      goalsActive: (goals.ACTIVE ?? 0) + (goals.AT_RISK ?? 0),
      goalsAtRisk: goals.AT_RISK ?? 0,
      goalsCompleted: goals.COMPLETED ?? 0,
      pipsActive:
        (pips.ACTIVE ?? 0) + (pips.ON_TRACK ?? 0) + (pips.AT_RISK ?? 0),
      developmentPlans: Object.values(development).reduce((a, b) => a + b, 0),
    },
    cyclesByStatus: cycles,
    reviewsByStatus: reviews,
    goalsByStatus: goals,
    pipsByStatus: pips,
  }
}

export async function performanceAnalytics(
  ctx: AccessContext,
  query: { organizationId?: string; cycleId?: string },
) {
  const organizationId = await requirePerformanceOrganization(ctx, query.organizationId)
  const branchIds = branchScopeForList(ctx)

  const [reviews, goals, pips, development, ratings, feedback, recognition, oneOnOnes] =
    await Promise.all([
      countByStatus('performance_reviews', organizationId, branchIds),
      countByStatus('employee_goals', organizationId, branchIds),
      countByStatus('performance_improvement_plans', organizationId, branchIds),
      countByStatus('development_plans', organizationId),
      ratingDistribution(organizationId, query.cycleId),
      listFeedback({ organizationId, skip: 0, limit: 1 }),
      listRecognitions({ organizationId, skip: 0, limit: 1 }),
      listOneOnOnes({ organizationId, skip: 0, limit: 1 }),
    ])

  const ratingTotal = ratings.reduce((a, r) => a + r.count, 0)
  const ratingDistributionSafe =
    ratingTotal >= ANALYTICS_PRIVACY_THRESHOLD
      ? ratings
      : {
          suppressed: true,
          reason: `Rating distribution requires at least ${ANALYTICS_PRIVACY_THRESHOLD} finalized reviews.`,
          sampleSize: ratingTotal,
        }

  return {
    generatedAt: new Date().toISOString(),
    reviewCompletion: {
      byStatus: reviews,
      total: Object.values(reviews).reduce((a, b) => a + b, 0),
      completed: (reviews.COMPLETED ?? 0) + (reviews.APPROVED ?? 0),
    },
    goalPerformance: {
      byStatus: goals,
      completed: goals.COMPLETED ?? 0,
      atRisk: goals.AT_RISK ?? 0,
      overdue: goals.OVERDUE ?? 0,
    },
    ratingDistribution: ratingDistributionSafe,
    pipAnalytics: {
      byStatus: pips,
      active: (pips.ACTIVE ?? 0) + (pips.ON_TRACK ?? 0) + (pips.AT_RISK ?? 0),
      successful: pips.SUCCESSFUL ?? 0,
      unsuccessful: pips.UNSUCCESSFUL ?? 0,
    },
    developmentAnalytics: {
      byStatus: development,
    },
    feedbackAnalytics: {
      feedbackCount: feedback.total,
      recognitionCount: recognition.total,
      oneOnOneCount: oneOnOnes.total,
    },
  }
}
