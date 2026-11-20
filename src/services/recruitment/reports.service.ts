import {
  countByStatus,
  listApplications,
  listCandidates,
  listOffers,
  listOnboardings,
} from '../../repositories/recruitment/recruitment.repository.js'
import type { AccessContext } from '../../types/access.js'
import { branchScopeForList, requireRecruitmentOrganization } from './recruitment-access.js'

/**
 * Recruitment analytics for authorized staff. Uses the same tenant/branch scope as the module.
 * Sensitive compensation figures are omitted from aggregate exports.
 */
export async function recruitmentFunnelReport(
  ctx: AccessContext,
  query: { organizationId?: string },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, query.organizationId)
  const branchIds = branchScopeForList(ctx)
  const applications = await countByStatus('applications', organizationId, branchIds)
  return {
    generatedAt: new Date().toISOString(),
    byStage: applications,
    hired: applications.HIRED ?? 0,
    rejected: applications.REJECTED ?? 0,
    withdrawn: applications.WITHDRAWN ?? 0,
  }
}

export async function applicationsBySourceReport(
  ctx: AccessContext,
  query: { organizationId?: string },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, query.organizationId)
  const branchIds = branchScopeForList(ctx)
  const { items } = await listApplications({
    organizationId,
    branchIds,
    skip: 0,
    limit: 500,
  })
  const bySource: Record<string, number> = {}
  for (const row of items) {
    const source = String(row.source ?? 'OTHER')
    bySource[source] = (bySource[source] ?? 0) + 1
  }
  return { generatedAt: new Date().toISOString(), bySource, sampleSize: items.length }
}

export async function offersSummaryReport(
  ctx: AccessContext,
  query: { organizationId?: string },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, query.organizationId)
  const branchIds = branchScopeForList(ctx)
  const offers = await countByStatus('offers', organizationId, branchIds)
  const accepted = offers.ACCEPTED ?? 0
  const rejected = offers.REJECTED ?? 0
  const decided = accepted + rejected
  return {
    generatedAt: new Date().toISOString(),
    byStatus: offers,
    acceptanceRate: decided === 0 ? null : Math.round((accepted / decided) * 10000) / 100,
  }
}

export async function onboardingProgressReport(
  ctx: AccessContext,
  query: { organizationId?: string },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, query.organizationId)
  const branchIds = branchScopeForList(ctx)
  const statuses = await countByStatus('employee_onboardings', organizationId, branchIds)
  const { items } = await listOnboardings({
    organizationId,
    branchIds,
    skip: 0,
    limit: 100,
  })
  const overdueTasksHint = items.filter(
    (o) => o.status === 'IN_PROGRESS' && Number(o.progressPercent ?? 0) < 100,
  ).length
  return {
    generatedAt: new Date().toISOString(),
    byStatus: statuses,
    inProgressWithIncompleteTasks: overdueTasksHint,
  }
}

export async function openRequisitionsReport(
  ctx: AccessContext,
  query: { organizationId?: string },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, query.organizationId)
  const branchIds = branchScopeForList(ctx)
  const requisitions = await countByStatus('job_requisitions', organizationId, branchIds)
  return {
    generatedAt: new Date().toISOString(),
    byStatus: requisitions,
    open:
      (requisitions.OPEN ?? 0) + (requisitions.APPROVED ?? 0) + (requisitions.ON_HOLD ?? 0),
  }
}

export async function candidateVolumeReport(
  ctx: AccessContext,
  query: { organizationId?: string },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, query.organizationId)
  const branchIds = branchScopeForList(ctx)
  const { total } = await listCandidates({
    organizationId,
    branchIds,
    skip: 0,
    limit: 1,
  })
  const offers = await listOffers({
    organizationId,
    branchIds,
    skip: 0,
    limit: 1,
  })
  return {
    generatedAt: new Date().toISOString(),
    candidates: total,
    offersSampleTotal: offers.total,
  }
}
