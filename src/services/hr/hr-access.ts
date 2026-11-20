import { ENTITY_STATUSES } from '../../constants/roles.js'
import { findBranchById } from '../../repositories/branches/branch.repository.js'
import { findEmployeeById, type EmployeeRecord } from '../../repositories/hr/hr.repository.js'
import { findLegalEntityById } from '../../repositories/legal-entities/legal-entity.repository.js'
import { findOrganizationById } from '../../repositories/organizations/organization.repository.js'
import type { AccessContext } from '../../types/access.js'
import { forbiddenError, invalidField, notFound } from '../../utils/httpErrors.js'
import {
  hasBranchAccess,
  hasOrganizationAccess,
  resolveOrganizationScope,
} from '../authorization/authorization.service.js'

export async function requireHrOrganization(ctx: AccessContext, organizationId?: string) {
  const orgId = resolveOrganizationScope(ctx, organizationId)
  if (!hasOrganizationAccess(ctx, orgId)) {
    throw forbiddenError('You do not have access to this organization.')
  }
  const organization = await findOrganizationById(orgId)
  if (!organization || organization.status !== ENTITY_STATUSES.ACTIVE) {
    throw invalidField('organizationId', 'Organization was not found or is not active.')
  }
  return orgId
}

export async function loadAccessibleEmployee(
  ctx: AccessContext,
  employeeId: string,
  organizationId?: string,
): Promise<EmployeeRecord> {
  const orgId = await requireHrOrganization(ctx, organizationId)
  const employee = await findEmployeeById(employeeId)
  if (!employee || employee.organizationId !== orgId) throw notFound('Employee was not found.')
  if (!hasBranchAccess(ctx, employee.branchId, employee.organizationId)) {
    throw notFound('Employee was not found.')
  }
  return employee
}

export async function assertBranchInOrg(branchId: string, organizationId: string) {
  const branch = await findBranchById(branchId)
  if (!branch || branch.organizationId !== organizationId) {
    throw invalidField('branchId', 'Branch was not found in this organization.')
  }
  if (branch.status !== ENTITY_STATUSES.ACTIVE) {
    throw invalidField('branchId', 'Branch is not active.')
  }
  return branch
}

export async function assertLegalEntityInOrg(legalEntityId: string, organizationId: string) {
  const entity = await findLegalEntityById(legalEntityId)
  if (!entity || entity.organizationId !== organizationId) {
    throw invalidField('legalEntityId', 'Legal entity was not found in this organization.')
  }
  if (entity.status !== ENTITY_STATUSES.ACTIVE) {
    throw invalidField('legalEntityId', 'Legal entity is not active.')
  }
  return entity
}

export function branchScopeForList(ctx: AccessContext): string[] | undefined {
  if (ctx.accessAllOrganizations || ctx.accessAllBranches) return undefined
  return [...ctx.branchIds]
}
