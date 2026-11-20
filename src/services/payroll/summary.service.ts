import { PAYROLL_RUN_STATUSES } from '../../constants/payroll.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  countRunsByStatus,
  findCurrentOpenPeriod,
  listPayrollRuns,
  sumPaidPayments,
} from '../../repositories/payroll/payroll.repository.js'
import type { AccessContext } from '../../types/access.js'
import { assertPermission, hasPermission } from '../authorization/authorization.service.js'
import { requirePayrollOrganization } from './payroll-access.js'
import { mapPeriod, mapRun } from './payroll.mapper.js'

export async function payrollSummaryService(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_VIEW)
  const organizationId = await requirePayrollOrganization(ctx, query.organizationId as string | undefined)
  const legalEntityId = query.legalEntityId ? String(query.legalEntityId) : undefined

  const [currentPeriod, statusCounts, paidCounts, recentRuns] = await Promise.all([
    findCurrentOpenPeriod(organizationId, legalEntityId),
    countRunsByStatus(organizationId),
    sumPaidPayments(organizationId),
    listPayrollRuns({ organizationId, limit: 5, skip: 0 }),
  ])

  const pendingApprovals =
    statusCounts.find((r) => r._id === PAYROLL_RUN_STATUSES.PENDING_APPROVAL)?.count ?? 0
  const calculated =
    statusCounts.find((r) => r._id === PAYROLL_RUN_STATUSES.CALCULATED)?.count ?? 0
  const paid = statusCounts.find((r) => r._id === PAYROLL_RUN_STATUSES.PAID)?.count ?? 0

  const sensitive = hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW)
  const latest = recentRuns.items[0]

  return {
    currentPeriod: currentPeriod ? mapPeriod(currentPeriod) : null,
    pendingApprovals,
    calculatedRuns: calculated,
    paidRuns: paid,
    paidPaymentBatches: paidCounts.reduce((sum, row) => sum + row.count, 0),
    latestRun: latest ? mapRun(latest, sensitive) : null,
    kpis: sensitive
      ? {
          grossPayroll: latest?.grossTotal ?? '0.00',
          totalDeductions: latest?.deductionTotal ?? '0.00',
          netPayroll: latest?.netTotal ?? '0.00',
          employerCost: latest?.employerCostTotal ?? '0.00',
          employeesIncluded: latest?.employeeCount ?? 0,
          currency: latest?.currency,
        }
      : {
          employeesIncluded: latest?.employeeCount ?? 0,
        },
  }
}
