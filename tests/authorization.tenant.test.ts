/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
/**
 * Authorization: tenant isolation, branch isolation, default-deny permissions and privilege
 * escalation guards. Runs against the real Express app with in-memory repositories.
 */
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeEach, describe, it, vi } from 'vitest'
import { app } from '../src/app.js'
import { ALL_PERMISSIONS, LEGACY_PERMISSIONS, PERMISSIONS } from '../src/constants/permissions.js'
import { ROLES, SYSTEM_ROLE_CODES } from '../src/constants/roles.js'
import { AppError } from '../src/exceptions/AppError.js'
import { signAccessToken } from '../src/lib/jwt/index.js'
import type { RoleRecord } from '../src/repositories/roles/role.repository.js'
import type { UserCredentials } from '../src/types/user.js'
import {
  assertRecordAccess,
  buildAccessContext,
  hasBranchAccess,
  hasLegalEntityAccess,
  hasOrganizationAccess,
  hasPermission,
} from '../src/services/authorization/authorization.service.js'
import {
  db,
  makeBranch,
  makeOrganization,
  makeUser,
  oid,
} from './helpers/fake-repositories.js'

vi.mock('../src/repositories/users/user.repository.js', async () =>
  (await import('./helpers/fake-repositories.js')).userRepository,
)
vi.mock('../src/repositories/audit/audit-event.repository.js', async () =>
  (await import('./helpers/fake-repositories.js')).auditRepository,
)
vi.mock('../src/repositories/organizations/organization.repository.js', async () =>
  (await import('./helpers/fake-repositories.js')).organizationRepository,
)
vi.mock('../src/repositories/roles/role.repository.js', async () =>
  (await import('./helpers/fake-repositories.js')).roleRepository,
)
vi.mock('../src/repositories/branches/branch.repository.js', async () =>
  (await import('./helpers/fake-repositories.js')).branchRepository,
)
vi.mock('../src/repositories/legal-entities/legal-entity.repository.js', async () =>
  (await import('./helpers/fake-repositories.js')).legalEntityRepository,
)
vi.mock('../src/repositories/auth/refresh-token.repository.js', async () =>
  (await import('./helpers/fake-repositories.js')).refreshTokenRepository,
)

const ORG_A = oid(1)
const ORG_B = oid(2)
const LE_A = oid(11)
const LE_B = oid(12)
const A1 = oid(21)
const A2 = oid(22)
const B1 = oid(23)

const ADMIN_A = oid(101)
const MANAGER_A1 = oid(102)
const USER_A2 = oid(103)
const ADMIN_B = oid(104)
const SUPER = oid(105)
const PLAIN_A = oid(106)
const USER_A1 = oid(107)

const ROLE_ORG_ADMIN = oid(201)
const ROLE_SUPER = oid(202)
const ROLE_CUSTOM_B = oid(203)

const server = app.listen(0)

function baseUrl(): string {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server has no port')
  return `http://127.0.0.1:${(address as AddressInfo).port}/api/v1`
}

function tokenFor(userId: string): string {
  const user = db.users.get(userId)
  if (!user) throw new Error(`unknown test user ${userId}`)
  return signAccessToken({ sub: userId, role: user.role }).token
}

async function call(method: string, path: string, as?: string, body?: unknown) {
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(as ? { authorization: `Bearer ${tokenFor(as)}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, text, body: JSON.parse(text) as Record<string, any> }
}

const ids = (items: { id: string }[]) => items.map((item) => item.id).sort()

function systemRole(id: string, code: string, permissionKeys: string[]): RoleRecord {
  const now = new Date()
  return {
    id,
    organizationId: null,
    code,
    name: code,
    permissionKeys,
    isSystem: true,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  }
}

function addUser(id: string, overrides: Partial<UserCredentials> & { email: string }): void {
  db.users.set(id, makeUser({ id, passwordHash: 'unused-in-these-tests', ...overrides }))
}

beforeEach(() => {
  db.reset()

  db.organizations.set(ORG_A, makeOrganization(ORG_A, 'ORG-A', 'Org A'))
  db.organizations.set(ORG_B, makeOrganization(ORG_B, 'ORG-B', 'Org B'))
  for (const [id, organizationId, name] of [
    [LE_A, ORG_A, 'LE A'],
    [LE_B, ORG_B, 'LE B'],
  ] as const) {
    db.legalEntities.set(id, {
      id,
      organizationId,
      legalName: name,
      displayName: name,
      status: 'ACTIVE',
      country: 'PK',
      defaultCurrency: 'PKR',
      timezone: 'Asia/Karachi',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
  db.branches.set(A1, makeBranch(A1, ORG_A, LE_A, 'A1'))
  db.branches.set(A2, makeBranch(A2, ORG_A, LE_A, 'A2'))
  db.branches.set(B1, makeBranch(B1, ORG_B, LE_B, 'B1'))

  db.roles.set(ROLE_ORG_ADMIN, systemRole(ROLE_ORG_ADMIN, SYSTEM_ROLE_CODES.ORG_ADMIN, []))
  db.roles.set(ROLE_SUPER, systemRole(ROLE_SUPER, SYSTEM_ROLE_CODES.SUPER_ADMIN, []))
  db.roles.set(ROLE_CUSTOM_B, {
    ...systemRole(ROLE_CUSTOM_B, 'B_CUSTOM', [PERMISSIONS.USERS_VIEW]),
    organizationId: ORG_B,
    isSystem: false,
  })

  addUser(ADMIN_A, {
    email: 'admin.a@example.com',
    name: 'Admin A',
    role: ROLES.ADMIN,
    organizationId: ORG_A,
    legalEntityIds: [LE_A],
    accessAllBranches: true,
  })
  addUser(MANAGER_A1, {
    email: 'manager.a1@example.com',
    name: 'Manager A1',
    role: ROLES.MANAGER,
    organizationId: ORG_A,
    legalEntityIds: [LE_A],
    branchIds: [A1],
  })
  addUser(USER_A2, {
    email: 'user.a2@example.com',
    name: 'User A2',
    role: ROLES.USER,
    organizationId: ORG_A,
    branchIds: [A2],
  })
  addUser(USER_A1, {
    email: 'user.a1@example.com',
    name: 'User A1',
    role: ROLES.USER,
    organizationId: ORG_A,
    branchIds: [A1],
  })
  addUser(PLAIN_A, {
    email: 'plain.a@example.com',
    name: 'Plain A',
    role: ROLES.USER,
    organizationId: ORG_A,
  })
  addUser(ADMIN_B, {
    email: 'admin.b@example.com',
    name: 'Admin B',
    role: ROLES.ADMIN,
    organizationId: ORG_B,
    accessAllBranches: true,
  })
  addUser(SUPER, {
    email: 'super@example.com',
    name: 'Super',
    role: ROLES.SUPER_ADMIN,
    organizationId: null,
    accessAllOrganizations: true,
    accessAllBranches: true,
  })
})

afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    }),
)

describe('cross-organization isolation', () => {
  it('lists only users of the actor organization', async () => {
    const result = await call('GET', '/users', ADMIN_A)

    assert.equal(result.status, 200)
    assert.deepEqual(ids(result.body.items), [ADMIN_A, MANAGER_A1, USER_A2, PLAIN_A, USER_A1].sort())
    assert.ok(!result.text.includes('passwordHash'))
  })

  it('hides users of another organization and platform accounts', async () => {
    for (const target of [ADMIN_B, SUPER]) {
      const read = await call('GET', `/users/${target}`, ADMIN_A)
      assert.equal(read.status, 404)
      assert.equal(read.body.error.code, 'NOT_FOUND')

      const write = await call('PATCH', `/users/${target}`, ADMIN_A, { name: 'Hijacked' })
      assert.equal(write.status, 404)

      const deactivate = await call('POST', `/users/${target}/deactivate`, ADMIN_A, {})
      assert.equal(deactivate.status, 404)
    }
    assert.equal(db.users.get(ADMIN_B)?.name, 'Admin B')
    assert.equal(db.users.get(ADMIN_B)?.status, 'ACTIVE')
  })

  it('refuses an organizationId filter pointing at another tenant', async () => {
    const result = await call('GET', `/users?organizationId=${ORG_B}`, ADMIN_A)
    assert.equal(result.status, 403)
  })

  it('shows an organization admin only their own organization', async () => {
    const list = await call('GET', '/organizations', ADMIN_A)
    assert.equal(list.status, 200)
    assert.deepEqual(ids(list.body.items), [ORG_A])

    const own = await call('GET', `/organizations/${ORG_A}`, ADMIN_A)
    assert.equal(own.status, 200)

    const other = await call('GET', `/organizations/${ORG_B}`, ADMIN_A)
    assert.equal(other.status, 404)

    const update = await call('PATCH', `/organizations/${ORG_B}`, ADMIN_A, { name: 'Mine now' })
    assert.equal(update.status, 404)
    assert.equal(db.organizations.get(ORG_B)?.name, 'Org B')
  })

  it('only lets platform administrators create organizations', async () => {
    const denied = await call('POST', '/organizations', ADMIN_A, { name: 'Org C', code: 'org-c' })
    assert.equal(denied.status, 403)

    const created = await call('POST', '/organizations', SUPER, { name: 'Org C', code: 'org-c' })
    assert.equal(created.status, 201)
    assert.equal(created.body.data.code, 'ORG-C')
    assert.ok(
      db.auditEvents.some((event) => event.action === 'organization.create' && event.actorUserId === SUPER),
    )

    const list = await call('GET', '/organizations', SUPER)
    assert.equal(list.body.total, 3)
  })

  it('blocks organization admins from changing the organization status', async () => {
    const result = await call('PATCH', `/organizations/${ORG_A}`, ADMIN_A, { status: 'inactive' })
    assert.equal(result.status, 403)
    assert.equal(db.organizations.get(ORG_A)?.status, 'ACTIVE')
  })

  it('does not let a branch be read or changed through another organization', async () => {
    const read = await call('GET', `/branches/${B1}`, ADMIN_A)
    assert.equal(read.status, 404)

    const update = await call('PATCH', `/branches/${B1}`, ADMIN_A, { name: 'Hijacked' })
    assert.equal(update.status, 404)
    assert.equal(db.branches.get(B1)?.name, 'Branch B1')

    const createInOther = await call('POST', '/branches', ADMIN_A, {
      organizationId: ORG_B,
      legalEntityId: LE_B,
      name: 'Sneaky',
      code: 'SNK',
      timezone: 'Asia/Karachi',
    })
    assert.equal(createInOther.status, 403)
  })

  it('rejects a legal entity from another organization when creating a branch', async () => {
    const result = await call('POST', '/branches', ADMIN_A, {
      legalEntityId: LE_B,
      name: 'Cross Entity',
      code: 'CRS',
      timezone: 'Asia/Karachi',
    })
    assert.equal(result.status, 422)
    assert.ok(result.body.errors.legalEntityId)
  })

  it('creates a branch inside the actor organization and audits it', async () => {
    const result = await call('POST', '/branches', ADMIN_A, {
      legalEntityId: LE_A,
      name: 'Branch A3',
      code: 'a3',
      timezone: 'Asia/Karachi',
    })
    assert.equal(result.status, 201)
    assert.equal(result.body.data.organizationId, ORG_A)
    assert.equal(result.body.data.code, 'A3')
    assert.ok(db.auditEvents.some((event) => event.action === 'branch.create'))
  })

  it('refuses to attach another organization branch to a new user', async () => {
    const result = await call('POST', '/users', ADMIN_A, {
      name: 'New Person',
      email: 'new.person@example.com',
      role: 'manager',
      branchIds: [B1],
    })
    assert.equal(result.status, 422)
    assert.ok(result.body.errors.branchIds)
    assert.ok(![...db.users.values()].some((user) => user.email === 'new.person@example.com'))
  })

  it('creates users in the actor organization regardless of the body', async () => {
    const created = await call('POST', '/users', ADMIN_A, {
      name: 'New Person',
      email: 'New.Person@example.com',
      role: 'manager',
      branchIds: [A1],
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.data.organizationId, ORG_A)
    assert.equal(created.body.data.status, 'invited')
    assert.equal(created.body.data.email, 'new.person@example.com')
    assert.ok(!created.text.includes('passwordHash'))
    assert.ok(db.auditEvents.some((event) => event.action === 'user.create'))

    const other = await call('POST', '/users', ADMIN_A, {
      name: 'Other Tenant',
      email: 'other.tenant@example.com',
      role: 'manager',
      organizationId: ORG_B,
    })
    assert.equal(other.status, 403)
  })
})

describe('branch isolation', () => {
  it('limits a branch-restricted user to the assigned branches', async () => {
    const list = await call('GET', '/branches', MANAGER_A1)
    assert.equal(list.status, 200)
    assert.deepEqual(ids(list.body.items), [A1])

    assert.equal((await call('GET', `/branches/${A1}`, MANAGER_A1)).status, 200)
    assert.equal((await call('GET', `/branches/${A2}`, MANAGER_A1)).status, 404)
    assert.equal((await call('GET', `/branches/${B1}`, MANAGER_A1)).status, 404)
  })

  it('shows a branch-restricted user only people who share a branch, plus themselves', async () => {
    const list = await call('GET', '/users', MANAGER_A1)
    assert.equal(list.status, 200)
    assert.deepEqual(ids(list.body.items), [MANAGER_A1, USER_A1].sort())

    assert.equal((await call('GET', `/users/${USER_A1}`, MANAGER_A1)).status, 200)
    assert.equal((await call('GET', `/users/${USER_A2}`, MANAGER_A1)).status, 404)
    assert.equal((await call('GET', `/users/${ADMIN_A}`, MANAGER_A1)).status, 404)
  })

  it('does not let an administrator hand out access to a branch outside their own scope', async () => {
    // A custom role with users.update but only branch A1.
    const limitedAdmin = oid(150)
    db.roles.set(oid(250), {
      ...systemRole(oid(250), 'A1_USER_ADMIN', [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_UPDATE]),
      organizationId: ORG_A,
      isSystem: false,
    })
    addUser(limitedAdmin, {
      email: 'limited.admin@example.com',
      role: ROLES.USER,
      organizationId: ORG_A,
      branchIds: [A1],
      roleIds: [oid(250)],
    })

    const result = await call('PUT', `/users/${USER_A1}/branches`, limitedAdmin, {
      branchIds: [A1, A2],
    })
    assert.equal(result.status, 403)
    assert.deepEqual(db.users.get(USER_A1)?.branchIds, [A1])
  })

  it('lets an organization admin assign branches inside the organization and audits the change', async () => {
    const result = await call('PUT', `/users/${USER_A1}/branches`, ADMIN_A, {
      branchIds: [A1, A2],
      legalEntityIds: [LE_A],
    })
    assert.equal(result.status, 200)
    assert.deepEqual(db.users.get(USER_A1)?.branchIds, [A1, A2])
    assert.ok(db.auditEvents.some((event) => event.action === 'branch.access_change'))

    const crossTenant = await call('PUT', `/users/${USER_A1}/branches`, ADMIN_A, { branchIds: [B1] })
    assert.equal(crossTenant.status, 422)
  })
})

describe('permissions are default deny', () => {
  it('rejects unauthenticated requests', async () => {
    assert.equal((await call('GET', '/users')).status, 401)
    assert.equal((await call('GET', '/branches')).status, 401)
    assert.equal((await call('GET', '/permissions')).status, 401)
  })

  it('refuses actions that need a permission the role does not hold', async () => {
    // A branch manager can view, but not create or change.
    assert.equal((await call('POST', '/branches', MANAGER_A1, {})).status, 403)
    assert.equal(
      (await call('PATCH', `/users/${USER_A1}`, MANAGER_A1, { name: 'Renamed' })).status,
      403,
    )
    assert.equal(
      (
        await call('POST', '/users', MANAGER_A1, {
          name: 'Nope Nope',
          email: 'nope@example.com',
          role: 'user',
        })
      ).status,
      403,
    )
    assert.equal((await call('GET', '/organizations', MANAGER_A1)).status, 403)
    assert.equal((await call('GET', '/roles', MANAGER_A1)).status, 403)
    assert.equal(db.users.get(USER_A1)?.name, 'User A1')
  })

  it('grants a standard user nothing beyond their profile', async () => {
    for (const path of ['/users', '/branches', '/organizations', '/legal-entities', '/roles', '/permissions']) {
      const result = await call('GET', path, PLAIN_A)
      assert.equal(result.status, 403, path)
      assert.equal(result.body.error.code, 'FORBIDDEN', path)
    }
    assert.equal((await call('GET', '/auth/me', PLAIN_A)).status, 200)
  })

  it('grants nothing to a user without an organization', async () => {
    const orphan = oid(160)
    addUser(orphan, { email: 'orphan@example.com', role: ROLES.ADMIN, organizationId: null })
    assert.equal((await call('GET', '/users', orphan)).status, 403)
  })

  it('exposes the permission catalog to role viewers', async () => {
    const result = await call('GET', '/permissions', ADMIN_A)
    assert.equal(result.status, 200)
    assert.equal(result.body.items.length, ALL_PERMISSIONS.length)
  })
})

describe('roles and privilege escalation', () => {
  it('hides the platform role and other organizations custom roles', async () => {
    const list = await call('GET', '/roles', ADMIN_A)
    assert.equal(list.status, 200)
    const codes = list.body.items.map((role: { code: string }) => role.code)
    assert.ok(codes.includes('ORG_ADMIN'))
    assert.ok(!codes.includes('SUPER_ADMIN'))
    assert.ok(!codes.includes('B_CUSTOM'))

    assert.equal((await call('GET', `/roles/${ROLE_SUPER}`, ADMIN_A)).status, 404)
    assert.equal((await call('GET', `/roles/${ROLE_CUSTOM_B}`, ADMIN_A)).status, 404)
  })

  it('refuses to edit system role permissions', async () => {
    const result = await call('PUT', `/roles/${ROLE_ORG_ADMIN}/permissions`, ADMIN_A, {
      permissionKeys: [PERMISSIONS.USERS_VIEW],
    })
    assert.equal(result.status, 403)
  })

  it('refuses to assign the super admin role through the API', async () => {
    const create = await call('POST', '/users', ADMIN_A, {
      name: 'Wannabe Root',
      email: 'root@example.com',
      role: 'super_admin',
    })
    assert.equal(create.status, 422)

    const patch = await call('PATCH', `/users/${USER_A1}`, ADMIN_A, { role: 'super_admin' })
    assert.equal(patch.status, 422)
    assert.equal(db.users.get(USER_A1)?.role, ROLES.USER)
  })

  it('records role assignments and blocks self-service role changes', async () => {
    const changed = await call('PUT', `/users/${MANAGER_A1}/roles`, ADMIN_A, { role: 'dispatcher' })
    assert.equal(changed.status, 200)
    assert.equal(db.users.get(MANAGER_A1)?.role, ROLES.DISPATCHER)
    assert.ok(db.auditEvents.some((event) => event.action === 'role.assign'))

    const self = await call('PUT', `/users/${ADMIN_A}/roles`, ADMIN_A, { role: 'viewer' })
    assert.equal(self.status, 403)
    assert.equal(db.users.get(ADMIN_A)?.role, ROLES.ADMIN)
  })

  it('deactivates a user, audits it, and the user loses access immediately', async () => {
    const token = tokenFor(USER_A1)
    assert.equal(
      (await fetch(`${baseUrl()}/auth/me`, { headers: { authorization: `Bearer ${token}` } })).status,
      200,
    )

    const result = await call('POST', `/users/${USER_A1}/deactivate`, ADMIN_A, { status: 'suspended' })
    assert.equal(result.status, 200)
    assert.equal(result.body.data.status, 'suspended')
    assert.ok(db.auditEvents.some((event) => event.action === 'user.status_change'))

    const after = await fetch(`${baseUrl()}/auth/me`, { headers: { authorization: `Bearer ${token}` } })
    assert.equal(after.status, 401)

    const self = await call('POST', `/users/${ADMIN_A}/deactivate`, ADMIN_A, {})
    assert.equal(self.status, 403)
  })
})

describe('AccessContext rules', () => {
  const adminRecord = () => {
    const { passwordHash: _hash, ...record } = db.users.get(ADMIN_A)!
    void _hash
    return record
  }

  it('resolves legacy permission aliases', () => {
    const admin = buildAccessContext(adminRecord(), [])
    assert.ok(hasPermission(admin, LEGACY_PERMISSIONS.USERS_READ))
    assert.ok(hasPermission(admin, LEGACY_PERMISSIONS.USERS_WRITE))

    const manager = buildAccessContext({ ...adminRecord(), role: ROLES.MANAGER }, [])
    assert.ok(hasPermission(manager, LEGACY_PERMISSIONS.USERS_READ))
    // users:write needs create + update + deactivate, which a branch manager lacks.
    assert.ok(!hasPermission(manager, LEGACY_PERMISSIONS.USERS_WRITE))
  })

  it('denies everything for non-active accounts', () => {
    for (const status of ['INACTIVE', 'SUSPENDED', 'INVITED'] as const) {
      const ctx = buildAccessContext({ ...adminRecord(), status }, [])
      assert.equal(ctx.permissions.size, 0, status)
      assert.ok(!hasPermission(ctx, PERMISSIONS.USERS_VIEW))
      assert.ok(!hasOrganizationAccess(ctx, ORG_A))
    }
  })

  it('does not trust a SUPER_ADMIN role without platform-wide scope', () => {
    const ctx = buildAccessContext({ ...adminRecord(), role: ROLES.SUPER_ADMIN }, [])
    assert.equal(ctx.permissions.size, 0)
  })

  it('only counts active custom roles from the same organization or the system', () => {
    const now = new Date()
    const custom = (overrides: Partial<RoleRecord>): RoleRecord => ({
      id: oid(300),
      organizationId: ORG_A,
      code: 'CUSTOM',
      name: 'Custom',
      permissionKeys: [PERMISSIONS.AUDIT_VIEW, 'not.a.permission'],
      isSystem: false,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    const base = { ...adminRecord(), role: ROLES.USER, accessAllBranches: false }

    assert.ok(hasPermission(buildAccessContext(base, [custom({})]), PERMISSIONS.AUDIT_VIEW))
    assert.ok(!hasPermission(buildAccessContext(base, [custom({ organizationId: ORG_B })]), PERMISSIONS.AUDIT_VIEW))
    assert.ok(!hasPermission(buildAccessContext(base, [custom({ status: 'INACTIVE' })]), PERMISSIONS.AUDIT_VIEW))
    // Unknown permission keys stored on a role are ignored.
    assert.ok(!buildAccessContext(base, [custom({})]).permissions.has('not.a.permission'))
  })

  it('scopes branch and legal entity access to the organization', () => {
    const orgWide = buildAccessContext(adminRecord(), [])
    assert.ok(hasBranchAccess(orgWide, A1, ORG_A))
    assert.ok(!hasBranchAccess(orgWide, B1, ORG_B), 'another organization')
    assert.ok(!hasBranchAccess(orgWide, A1), 'organization-wide scope needs the organization id')
    assert.ok(hasLegalEntityAccess(orgWide, LE_A, ORG_A))

    const limited = buildAccessContext(
      { ...adminRecord(), accessAllBranches: false, branchIds: [A1], legalEntityIds: [LE_A] },
      [],
    )
    assert.ok(hasBranchAccess(limited, A1, ORG_A))
    assert.ok(!hasBranchAccess(limited, A2, ORG_A))
    assert.ok(!hasBranchAccess(limited, A1, ORG_B))

    const platform = buildAccessContext(db.users.get(SUPER)!, [])
    assert.ok(hasBranchAccess(platform, B1, ORG_B))
    assert.ok(hasOrganizationAccess(platform, ORG_B))
  })

  it('assertRecordAccess throws a 403 AppError on any failed check', () => {
    const limited = buildAccessContext(
      { ...adminRecord(), accessAllBranches: false, branchIds: [A1], legalEntityIds: [] },
      [],
    )
    const expectForbidden = (fn: () => void) => {
      assert.throws(fn, (error: unknown) => error instanceof AppError && error.statusCode === 403)
    }

    assertRecordAccess(limited, { permission: PERMISSIONS.BRANCHES_VIEW, organizationId: ORG_A, branchId: A1 })
    expectForbidden(() =>
      assertRecordAccess(limited, { permission: PERMISSIONS.BRANCHES_VIEW, organizationId: ORG_B }),
    )
    expectForbidden(() =>
      assertRecordAccess(limited, { permission: PERMISSIONS.BRANCHES_VIEW, organizationId: ORG_A, branchId: A2 }),
    )
    expectForbidden(() =>
      assertRecordAccess(limited, { permission: PERMISSIONS.BRANCHES_VIEW, organizationId: ORG_A, legalEntityId: LE_A }),
    )
    const standard = buildAccessContext({ ...adminRecord(), role: ROLES.USER }, [])
    expectForbidden(() =>
      assertRecordAccess(standard, { permission: PERMISSIONS.BRANCHES_VIEW, organizationId: ORG_A }),
    )
  })
})
