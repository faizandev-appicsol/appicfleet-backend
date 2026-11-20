import { countByStatus, listInterviews } from '../../repositories/recruitment/recruitment.repository.js'
import type { AccessContext } from '../../types/access.js'
import { branchScopeForList, requireRecruitmentOrganization } from './recruitment-access.js'

export async function recruitmentDashboard(
  ctx: AccessContext,
  query: { organizationId?: string },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, query.organizationId)
  const branchIds = branchScopeForList(ctx)

  const [requisitions, applications, offers, onboardings, interviews] = await Promise.all([
    countByStatus('job_requisitions', organizationId, branchIds),
    countByStatus('applications', organizationId, branchIds),
    countByStatus('offers', organizationId, branchIds),
    countByStatus('employee_onboardings', organizationId, branchIds),
    listInterviews({
      organizationId,
      status: 'SCHEDULED',
      from: new Date(),
      branchIds,
      skip: 0,
      limit: 10,
    }),
  ])

  const openRequisitions =
    (requisitions.OPEN ?? 0) + (requisitions.APPROVED ?? 0) + (requisitions.ON_HOLD ?? 0)
  const inInterview = applications.INTERVIEW ?? 0
  const pendingOffers =
    (offers.PENDING_APPROVAL ?? 0) + (offers.APPROVED ?? 0) + (offers.SENT ?? 0) + (offers.VIEWED ?? 0)

  return {
    kpis: {
      openRequisitions,
      applications: Object.values(applications).reduce((a, b) => a + b, 0),
      candidatesInInterview: inInterview,
      pendingOffers,
      acceptedOffers: offers.ACCEPTED ?? 0,
      onboardingInProgress: onboardings.IN_PROGRESS ?? 0,
      upcomingInterviews: interviews.total,
    },
    requisitionsByStatus: requisitions,
    applicationsByStatus: applications,
    offersByStatus: offers,
    onboardingsByStatus: onboardings,
  }
}
