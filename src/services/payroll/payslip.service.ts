import { PERMISSIONS } from '../../constants/permissions.js'
import { findEmployeeByUserId } from '../../repositories/hr/hr.repository.js'
import {
  findPayslipById,
  listPayslips,
} from '../../repositories/payroll/payroll.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { forbiddenError, notFound } from '../../utils/httpErrors.js'
import { assertPermission, hasPermission } from '../authorization/authorization.service.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { requirePayrollOrganization } from './payroll-access.js'
import { mapPayslip } from './payroll.mapper.js'

function parsePage(query: { page?: number; pageSize?: number }) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export async function listPayslipsService(ctx: AccessContext, query: Record<string, unknown>) {
  const selfServiceOnly =
    hasPermission(ctx, PERMISSIONS.PAYROLL_SELF_SERVICE) &&
    !hasPermission(ctx, PERMISSIONS.PAYROLL_PAYSLIP_MANAGE) &&
    !hasPermission(ctx, PERMISSIONS.PAYROLL_VIEW)

  if (selfServiceOnly) {
    assertPermission(ctx, PERMISSIONS.PAYROLL_SELF_SERVICE)
  } else {
    assertPermission(ctx, PERMISSIONS.PAYROLL_PAYSLIP_VIEW)
  }

  const organizationId = await requirePayrollOrganization(ctx, query.organizationId as string | undefined)
  let employeeId = query.employeeId ? String(query.employeeId) : undefined

  if (selfServiceOnly) {
    const me = await findEmployeeByUserId(organizationId, ctx.userId)
    if (!me) throw forbiddenError('No employee profile is linked to your user account.')
    employeeId = me.id
  }

  const { page, pageSize, skip } = parsePage(query as { page?: number; pageSize?: number })
  const result = await listPayslips({
    organizationId,
    employeeId,
    payrollRunId: query.payrollRunId ? String(query.payrollRunId) : undefined,
    payrollPeriodId: query.payrollPeriodId ? String(query.payrollPeriodId) : undefined,
    limit: pageSize,
    skip,
  })
  const sensitive =
    hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW) || selfServiceOnly
  return {
    items: result.items.map((p) => mapPayslip(p, sensitive)),
    page,
    pageSize,
    total: result.total,
  }
}

export async function getPayslipService(ctx: AccessContext, id: string) {
  const payslip = await findPayslipById(id)
  if (!payslip) throw notFound('Payslip was not found.')
  await requirePayrollOrganization(ctx, payslip.organizationId)

  const isAdmin = hasPermission(ctx, PERMISSIONS.PAYROLL_PAYSLIP_VIEW)
  const selfService = hasPermission(ctx, PERMISSIONS.PAYROLL_SELF_SERVICE)
  if (!isAdmin && !selfService) {
    throw forbiddenError('You do not have permission to view payslips.')
  }

  if (!isAdmin) {
    const me = await findEmployeeByUserId(payslip.organizationId, ctx.userId)
    if (!me || me.id !== payslip.employeeId) {
      throw notFound('Payslip was not found.')
    }
  }

  const sensitive =
    hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW) ||
    (!isAdmin && selfService)
  return mapPayslip(payslip, sensitive)
}

export async function downloadPayslipService(
  ctx: AccessContext,
  id: string,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_PAYSLIP_DOWNLOAD)
  const payslip = await findPayslipById(id)
  if (!payslip) throw notFound('Payslip was not found.')
  await requirePayrollOrganization(ctx, payslip.organizationId)

  const isAdmin = hasPermission(ctx, PERMISSIONS.PAYROLL_PAYSLIP_MANAGE) ||
    hasPermission(ctx, PERMISSIONS.PAYROLL_VIEW)
  if (!isAdmin) {
    const me = await findEmployeeByUserId(payslip.organizationId, ctx.userId)
    if (!me || me.id !== payslip.employeeId) {
      throw notFound('Payslip was not found.')
    }
  }

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_PAYSLIP_DOWNLOADED,
    entityType: AUDIT_ENTITY_TYPES.PAYSLIP,
    entityId: payslip.id,
    actorUserId: ctx.userId,
    organizationId: payslip.organizationId,
    metadata: { payslipNumber: payslip.payslipNumber },
    meta,
  })

  // Structured document payload for PDF/export renderers (no raw storage paths).
  return {
    payslip: mapPayslip(payslip, true),
    document: payslip.documentPayload ?? {
      payslipNumber: payslip.payslipNumber,
      employeeNumber: payslip.employeeNumber,
      currency: payslip.currency,
      payDate: payslip.payDate.toISOString(),
      earnings: payslip.earnings,
      deductions: payslip.deductions,
      grossSalary: payslip.grossSalary,
      netSalary: payslip.netSalary,
    },
    format: 'structured_json',
    note: 'Render via existing document/export infrastructure. Salary amounts are not included in notification channels.',
  }
}
