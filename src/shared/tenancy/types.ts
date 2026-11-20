/**
 * Tenant / branch isolation primitives.
 *
 * Future domain documents should carry organizationId (and optionally branchId)
 * and every repository query for tenant data must scope by these identifiers.
 * Do not implement cross-tenant reads or writes from controllers.
 */
export type OrganizationId = string
export type BranchId = string

export type TenantScope = {
  organizationId: OrganizationId
  branchId?: BranchId
}

export type TenantScoped = {
  organizationId: OrganizationId
  branchId?: BranchId | null
}
