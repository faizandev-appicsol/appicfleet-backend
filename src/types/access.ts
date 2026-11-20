import type { PermissionInput } from '../constants/permissions.js'
import type { UserStatus } from '../constants/roles.js'

/**
 * Resolved authorization state for one authenticated request.
 * Built server-side from the database on every request; never trusted from the client or token.
 */
export type AccessContext = {
  userId: string
  /** null only for platform-wide (accessAllOrganizations) accounts. */
  organizationId: string | null
  /** Canonical dotted permission keys. Legacy aliases are expanded at check time. */
  permissions: ReadonlySet<string>
  /** Primary system role code plus any custom role codes. */
  roleCodes: readonly string[]
  branchIds: readonly string[]
  legalEntityIds: readonly string[]
  /** Organization-wide scope inside organizationId. */
  accessAllBranches: boolean
  /** Platform-wide scope across organizations. */
  accessAllOrganizations: boolean
  status: UserStatus
}

export type RecordAccessTarget = {
  permission: PermissionInput
  organizationId: string
  branchId?: string
  legalEntityId?: string
}

/** Request metadata passed from controllers to services for audit trails. */
export type RequestMeta = {
  requestId?: string
  correlationId?: string
  ip?: string
  userAgent?: string
}
