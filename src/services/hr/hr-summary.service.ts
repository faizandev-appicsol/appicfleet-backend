import { EMPLOYMENT_STATUSES } from '../../constants/hr.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  countDocumentStatuses,
  countEmployeesByStatus,
  countEmployeesGrouped,
} from '../../repositories/hr/hr.repository.js'
import type { AccessContext } from '../../types/access.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { branchScopeForList, requireHrOrganization } from './hr-access.js'

export async function getHrSummary(ctx: AccessContext, organizationId?: string) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_VIEW)
  const orgId = await requireHrOrganization(ctx, organizationId)
  const branchIds = branchScopeForList(ctx)

  const [byStatus, byDepartment, byBranch, byType, documents] = await Promise.all([
    countEmployeesByStatus(orgId, branchIds),
    countEmployeesGrouped(orgId, 'departmentId', branchIds),
    countEmployeesGrouped(orgId, 'branchId', branchIds),
    countEmployeesGrouped(orgId, 'employmentType', branchIds),
    countDocumentStatuses(orgId),
  ])

  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0)
  return {
    generatedAt: new Date().toISOString(),
    totals: {
      employees: total,
      active: byStatus[EMPLOYMENT_STATUSES.ACTIVE] ?? 0,
      onLeave: byStatus[EMPLOYMENT_STATUSES.ON_LEAVE] ?? 0,
      suspended: byStatus[EMPLOYMENT_STATUSES.SUSPENDED] ?? 0,
      terminated: byStatus[EMPLOYMENT_STATUSES.TERMINATED] ?? 0,
    },
    byStatus,
    byDepartment,
    byBranch,
    byEmploymentType: byType,
    documents: {
      valid: documents.VALID ?? 0,
      expiringSoon: documents.EXPIRING_SOON ?? 0,
      expired: documents.EXPIRED ?? 0,
    },
  }
}
