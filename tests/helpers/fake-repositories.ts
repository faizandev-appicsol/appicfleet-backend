/**
 * In-memory stand-ins for the Mongoose repositories, so API tests run without MongoDB.
 * Wire them up in a test file with, for example:
 *
 *   vi.mock('../src/repositories/users/user.repository.js', async () =>
 *     (await import('./helpers/fake-repositories.js')).userRepository)
 *
 * Behaviour mirrors the real repositories where it matters for security: tenant filters, scoped
 * updates, and lock counting. Records are deep-copied on the way out so tests cannot mutate state
 * by accident.
 */
import { ENTITY_STATUSES, normalizeUserStatus, type Role, type UserStatus } from '../../src/constants/roles.js'
import type { BranchRecord } from '../../src/repositories/branches/branch.repository.js'
import type { LegalEntityRecord } from '../../src/repositories/legal-entities/legal-entity.repository.js'
import type { OrganizationRecord } from '../../src/repositories/organizations/organization.repository.js'
import type { RoleRecord } from '../../src/repositories/roles/role.repository.js'
import type { NewAuditEvent } from '../../src/repositories/audit/audit-event.repository.js'
import type { UserCredentials } from '../../src/types/user.js'

/** Deterministic 24-hex ObjectId-shaped identifier. */
export function oid(n: number): string {
  return n.toString(16).padStart(24, '0')
}

type TokenRow = { userId: string; token: string; revoked: boolean }

let counter = 5000

export const db = {
  users: new Map<string, UserCredentials>(),
  organizations: new Map<string, OrganizationRecord>(),
  legalEntities: new Map<string, LegalEntityRecord>(),
  branches: new Map<string, BranchRecord>(),
  roles: new Map<string, RoleRecord>(),
  refreshTokens: new Map<string, TokenRow>(),
  auditEvents: [] as NewAuditEvent[],
  reset(): void {
    this.users.clear()
    this.organizations.clear()
    this.legalEntities.clear()
    this.branches.clear()
    this.roles.clear()
    this.refreshTokens.clear()
    this.auditEvents.length = 0
  },
}

export function nextId(): string {
  counter += 1
  return oid(counter)
}

const NOW = new Date('2026-01-01T00:00:00.000Z')

export function makeUser(
  overrides: Partial<UserCredentials> & { id: string; email: string; passwordHash: string },
): UserCredentials {
  return {
    name: 'Test User',
    phone: undefined,
    organizationId: null,
    role: 'USER' as Role,
    roleIds: [],
    status: 'ACTIVE' as UserStatus,
    legalEntityIds: [],
    branchIds: [],
    accessAllBranches: false,
    accessAllOrganizations: false,
    lastLoginAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

export function makeOrganization(id: string, code: string, name = code): OrganizationRecord {
  return { id, code, name, status: ENTITY_STATUSES.ACTIVE, createdAt: NOW, updatedAt: NOW }
}

export function makeBranch(
  id: string,
  organizationId: string,
  legalEntityId: string,
  code: string,
): BranchRecord {
  return {
    id,
    organizationId,
    legalEntityId,
    code,
    name: `Branch ${code}`,
    timezone: 'Asia/Karachi',
    status: ENTITY_STATUSES.ACTIVE,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function publicUser(user: UserCredentials | undefined): Omit<UserCredentials, 'passwordHash'> | null {
  if (!user) return null
  const { passwordHash: _omit, ...rest } = clone(user)
  void _omit
  return { ...rest, status: normalizeUserStatus(rest.status) }
}

function paginate<T>(items: T[], skip: number, take: number): T[] {
  return items.slice(skip, skip + take)
}

export const userRepository = {
  async findUserById(id: string) {
    return publicUser(db.users.get(id))
  },
  async findCredentialsByEmail(email: string) {
    const found = [...db.users.values()].find((user) => user.email === email)
    return found ? clone(found) : null
  },
  async createUser(input: {
    email: string
    name: string
    phone?: string
    passwordHash: string
    organizationId: string | null
    role: Role
    status: UserStatus
    branchIds?: string[]
    legalEntityIds?: string[]
    accessAllBranches?: boolean
  }) {
    const id = nextId()
    const created = makeUser({
      id,
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name,
      phone: input.phone,
      organizationId: input.organizationId,
      role: input.role,
      status: input.status,
      branchIds: input.branchIds ?? [],
      legalEntityIds: input.legalEntityIds ?? [],
      accessAllBranches: input.accessAllBranches ?? false,
    })
    db.users.set(id, created)
    return publicUser(created)
  },
  async listUsers(input: {
    skip: number
    take: number
    search?: string
    scope: {
      organizationId?: string
      branchIds?: string[]
      includeUserId?: string
      status?: UserStatus
    }
  }) {
    const { scope } = input
    const all = [...db.users.values()].filter((user) => {
      if (scope.organizationId && user.organizationId !== scope.organizationId) return false
      if (scope.branchIds) {
        const shares = user.branchIds.some((branchId) => scope.branchIds?.includes(branchId))
        if (!shares && user.id !== scope.includeUserId) return false
      }
      if (scope.status && normalizeUserStatus(user.status) !== scope.status) return false
      if (input.search && !user.name.toLowerCase().includes(input.search.toLowerCase())) return false
      return true
    })
    return {
      items: paginate(all, input.skip, input.take).map((user) => publicUser(user)),
      total: all.length,
    }
  },
  async updateUser(id: string, input: Record<string, unknown>) {
    const user = db.users.get(id)
    if (!user) throw new Error('missing user')
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) (user as Record<string, unknown>)[key] = value
    }
    return publicUser(user)
  },
  async updateUserStatus(id: string, status: UserStatus) {
    const user = db.users.get(id)
    if (!user) throw new Error('missing user')
    user.status = status
    user.failedLoginAttempts = 0
    user.lockedUntil = null
    return publicUser(user)
  },
  async updateUserAccess(
    id: string,
    input: { branchIds: string[]; legalEntityIds: string[]; accessAllBranches: boolean },
  ) {
    const user = db.users.get(id)
    if (!user) throw new Error('missing user')
    Object.assign(user, input)
    return publicUser(user)
  },
  async updateUserRoles(id: string, input: { role?: Role; roleIds?: string[] }) {
    const user = db.users.get(id)
    if (!user) throw new Error('missing user')
    if (input.role) user.role = input.role
    if (input.roleIds) user.roleIds = input.roleIds
    return publicUser(user)
  },
  async recordLoginSuccess(id: string) {
    const user = db.users.get(id)
    if (!user) return
    user.lastLoginAt = new Date()
    user.failedLoginAttempts = 0
    user.lockedUntil = null
  },
  async recordFailedLogin(id: string, options: { maxAttempts: number; lockMs: number }) {
    const user = db.users.get(id)
    if (!user) return { failedLoginAttempts: 0, lockedUntil: null }
    if (user.lockedUntil && user.lockedUntil.getTime() <= Date.now()) {
      user.failedLoginAttempts = 0
      user.lockedUntil = null
    }
    user.failedLoginAttempts += 1
    if (user.failedLoginAttempts >= options.maxAttempts) {
      user.lockedUntil = new Date(Date.now() + options.lockMs)
    }
    return { failedLoginAttempts: user.failedLoginAttempts, lockedUntil: user.lockedUntil }
  },
  async deleteUser(id: string) {
    db.users.delete(id)
  },
}

export const refreshTokenRepository = {
  async saveRefreshToken(input: { id: string; userId: string; token: string }) {
    db.refreshTokens.set(input.id, { userId: input.userId, token: input.token, revoked: false })
  },
  async revokeAllRefreshTokens(userId: string) {
    for (const row of db.refreshTokens.values()) {
      if (row.userId === userId) row.revoked = true
    }
  },
  async rotateRefreshToken(input: {
    jti: string
    userId: string
    presentedToken: string
    nextId: string
    nextToken: string
  }) {
    const current = db.refreshTokens.get(input.jti)
    if (!current || current.userId !== input.userId) return 'missing' as const
    if (current.revoked || current.token !== input.presentedToken) {
      await refreshTokenRepository.revokeAllRefreshTokens(input.userId)
      return 'reused' as const
    }
    current.revoked = true
    db.refreshTokens.set(input.nextId, {
      userId: input.userId,
      token: input.nextToken,
      revoked: false,
    })
    return 'rotated' as const
  },
  async revokePresentedRefreshToken() {
    // Not used by the current services.
  },
}

export const auditRepository = {
  async insertAuditEvent(event: NewAuditEvent) {
    db.auditEvents.push(clone(event))
  },
}

export const organizationRepository = {
  async findOrganizationById(id: string) {
    const found = db.organizations.get(id)
    return found ? clone(found) : null
  },
  async listOrganizations(input: { skip: number; take: number; onlyIds?: string[] }) {
    const all = [...db.organizations.values()].filter(
      (organization) => !input.onlyIds || input.onlyIds.includes(organization.id),
    )
    return { items: paginate(all, input.skip, input.take).map(clone), total: all.length }
  },
  async createOrganization(input: { name: string; code: string; status: OrganizationRecord['status'] }) {
    if ([...db.organizations.values()].some((organization) => organization.code === input.code)) {
      throw new Error('duplicate code')
    }
    const record = { ...makeOrganization(nextId(), input.code, input.name), status: input.status }
    db.organizations.set(record.id, record)
    return clone(record)
  },
  async updateOrganization(id: string, input: Partial<OrganizationRecord>) {
    const record = db.organizations.get(id)
    if (!record) return null
    Object.assign(record, Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)))
    return clone(record)
  },
}

export const legalEntityRepository = {
  async findLegalEntityById(id: string) {
    const found = db.legalEntities.get(id)
    return found ? clone(found) : null
  },
  async countLegalEntitiesInOrganization(organizationId: string, ids: readonly string[]) {
    return new Set(
      ids.filter((id) => db.legalEntities.get(id)?.organizationId === organizationId),
    ).size
  },
  async listLegalEntities(input: {
    organizationId: string
    skip: number
    take: number
    onlyIds?: string[]
  }) {
    const all = [...db.legalEntities.values()].filter(
      (entity) =>
        entity.organizationId === input.organizationId &&
        (!input.onlyIds || input.onlyIds.includes(entity.id)),
    )
    return { items: paginate(all, input.skip, input.take).map(clone), total: all.length }
  },
  async createLegalEntity() {
    throw new Error('not implemented in fakes')
  },
  async updateLegalEntity() {
    throw new Error('not implemented in fakes')
  },
}

export const branchRepository = {
  async findBranchById(id: string) {
    const found = db.branches.get(id)
    return found ? clone(found) : null
  },
  async findBranchesByIds(ids: readonly string[]) {
    return ids.map((id) => db.branches.get(id)).filter((branch) => branch !== undefined).map(clone)
  },
  async findBranchesByOrganization(organizationId: string) {
    return [...db.branches.values()]
      .filter((branch) => branch.organizationId === organizationId)
      .map(clone)
  },
  async countBranchesInOrganization(organizationId: string, ids: readonly string[]) {
    return new Set(ids.filter((id) => db.branches.get(id)?.organizationId === organizationId)).size
  },
  async listBranches(input: {
    organizationId: string
    skip: number
    take: number
    onlyIds?: string[]
  }) {
    const all = [...db.branches.values()].filter(
      (branch) =>
        branch.organizationId === input.organizationId &&
        (!input.onlyIds || input.onlyIds.includes(branch.id)),
    )
    return { items: paginate(all, input.skip, input.take).map(clone), total: all.length }
  },
  async createBranch(input: Omit<BranchRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    const duplicate = [...db.branches.values()].some(
      (branch) => branch.organizationId === input.organizationId && branch.code === input.code,
    )
    if (duplicate) throw new Error('duplicate code')
    const record: BranchRecord = { ...input, id: nextId(), createdAt: NOW, updatedAt: NOW }
    db.branches.set(record.id, record)
    return clone(record)
  },
  async updateBranch(id: string, organizationId: string, input: Partial<BranchRecord>) {
    const record = db.branches.get(id)
    // Mirrors the real repository: updates are scoped by organizationId.
    if (!record || record.organizationId !== organizationId) return null
    Object.assign(record, Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)))
    return clone(record)
  },
}

export const roleRepository = {
  async findRoleById(id: string) {
    const found = db.roles.get(id)
    return found ? clone(found) : null
  },
  async findRolesByIds(ids: readonly string[]) {
    return ids.map((id) => db.roles.get(id)).filter((role) => role !== undefined).map(clone)
  },
  async listRoles(input: { organizationId: string | null; all?: boolean }) {
    return [...db.roles.values()]
      .filter(
        (role) =>
          input.all || role.organizationId === null || role.organizationId === input.organizationId,
      )
      .map(clone)
  },
  async createRole() {
    throw new Error('not implemented in fakes')
  },
  async updateCustomRolePermissions(id: string, permissionKeys: string[]) {
    const role = db.roles.get(id)
    if (!role || role.isSystem) return null
    role.permissionKeys = permissionKeys
    return clone(role)
  },
}
