/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
/**
 * Auth security behaviour: valid and invalid sign-in, blocked account states, lockout,
 * token/session handling and audit trail. Runs against the real Express app with in-memory
 * repositories (no MongoDB).
 */
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest'
import { app } from '../src/app.js'
import { hashPassword } from '../src/lib/password/index.js'
import { signAccessToken } from '../src/lib/jwt/index.js'
import { db, makeBranch, makeOrganization, makeUser, oid } from './helpers/fake-repositories.js'

vi.mock('../src/repositories/users/user.repository.js', async () =>
  (await import('./helpers/fake-repositories.js')).userRepository,
)
vi.mock('../src/repositories/auth/refresh-token.repository.js', async () =>
  (await import('./helpers/fake-repositories.js')).refreshTokenRepository,
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

const PASSWORD = 'Correct-Horse-9'
const ORG = oid(1)
const BRANCH = oid(21)
const USER_ID = oid(101)
const EMAIL = 'ada@example.com'

const server = app.listen(0)

function baseUrl(): string {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server has no port')
  return `http://127.0.0.1:${(address as AddressInfo).port}/api/v1`
}

async function call(
  method: string,
  path: string,
  options: { token?: string; body?: unknown; cookie?: string } = {},
) {
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const text = await response.text()
  return {
    status: response.status,
    text,
    body: JSON.parse(text) as Record<string, any>,
    setCookie: response.headers.get('set-cookie'),
  }
}

const login = (password = PASSWORD, email = EMAIL) =>
  call('POST', '/auth/login', { body: { email, password } })

function errorCode(result: { body: Record<string, any> }): string {
  return result.body.error?.code
}

let passwordHash = ''

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD)
})

afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    }),
)

beforeEach(() => {
  db.reset()
  db.organizations.set(ORG, makeOrganization(ORG, 'ORG-A', 'Org A'))
  db.branches.set(BRANCH, makeBranch(BRANCH, ORG, oid(11), 'A1'))
  db.users.set(
    USER_ID,
    makeUser({
      id: USER_ID,
      email: EMAIL,
      name: 'Ada Admin',
      passwordHash,
      role: 'ADMIN',
      organizationId: ORG,
      accessAllBranches: true,
    }),
  )
})

describe('sign-in', () => {
  it('signs in with valid credentials and returns session context without secrets', async () => {
    const result = await login()

    assert.equal(result.status, 200)
    assert.equal(typeof result.body.accessToken, 'string')
    assert.equal(result.body.user.organizationId, ORG)
    assert.equal(result.body.user.accessAllBranches, true)
    assert.ok(result.body.user.permissions.includes('users.view'))
    assert.ok(result.setCookie?.includes('HttpOnly'))
    // The hash, the password and the refresh token never appear in the JSON body.
    assert.ok(!result.text.includes('passwordHash'))
    assert.ok(!result.text.includes(passwordHash))
    assert.ok(!result.text.includes(PASSWORD))
    assert.ok(!result.text.includes('refreshToken'))

    const stored = db.users.get(USER_ID)
    assert.ok(stored?.lastLoginAt instanceof Date)
    assert.equal(stored?.failedLoginAttempts, 0)
    assert.ok(db.auditEvents.some((event) => event.action === 'auth.login' && event.result === 'success'))
  })

  it('rejects a wrong password and an unknown email with the same response', async () => {
    const wrongPassword = await login('not-the-password')
    const unknownEmail = await login(PASSWORD, 'nobody@example.com')

    assert.equal(wrongPassword.status, 401)
    assert.equal(unknownEmail.status, 401)
    assert.equal(errorCode(wrongPassword), 'INVALID_CREDENTIALS')
    assert.equal(errorCode(unknownEmail), 'INVALID_CREDENTIALS')
    assert.equal(wrongPassword.body.message, unknownEmail.body.message)
    assert.equal(db.users.get(USER_ID)?.failedLoginAttempts, 1)

    const failures = db.auditEvents.filter((event) => event.action === 'auth.login_failed')
    assert.equal(failures.length, 2)
    assert.ok(failures.every((event) => event.result === 'failure'))
    // Audit metadata carries a reason code only, never the attempted password.
    assert.ok(!JSON.stringify(db.auditEvents).includes('not-the-password'))
  })

  it.each([
    ['INACTIVE', 'ACCOUNT_DISABLED'],
    ['DISABLED', 'ACCOUNT_DISABLED'],
    ['SUSPENDED', 'ACCOUNT_SUSPENDED'],
    ['INVITED', 'ACCOUNT_INVITED'],
  ] as const)('refuses sign-in for a %s account even with the right password', async (status, code) => {
    const user = db.users.get(USER_ID)
    assert.ok(user)
    user.status = status

    const result = await login()

    assert.equal(result.status, 403)
    assert.equal(errorCode(result), code)
    assert.equal(result.setCookie, null)
    assert.ok(db.auditEvents.some((event) => event.action === 'auth.login_failed'))
  })

  it('refuses sign-in when the organization is inactive', async () => {
    const organization = db.organizations.get(ORG)
    assert.ok(organization)
    organization.status = 'INACTIVE'

    const result = await login()

    assert.equal(result.status, 403)
    assert.equal(result.setCookie, null)
  })

  it('locks the account after repeated failures and resets the counter on success', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await login('wrong-password')
      assert.equal(failed.status, 401)
    }
    assert.equal(db.users.get(USER_ID)?.failedLoginAttempts, 5)
    assert.ok(db.users.get(USER_ID)?.lockedUntil)

    // Even the correct password is refused while locked.
    const locked = await login()
    assert.equal(locked.status, 423)
    assert.equal(errorCode(locked), 'ACCOUNT_LOCKED')

    // After the lock expires the correct password works and the counter resets.
    const user = db.users.get(USER_ID)
    assert.ok(user)
    user.lockedUntil = new Date(Date.now() - 1_000)
    const ok = await login()
    assert.equal(ok.status, 200)
    assert.equal(db.users.get(USER_ID)?.failedLoginAttempts, 0)
    assert.equal(db.users.get(USER_ID)?.lockedUntil, null)
  })
})

describe('session', () => {
  it('requires a bearer token', async () => {
    const missing = await call('GET', '/auth/me')
    assert.equal(missing.status, 401)
    assert.equal(errorCode(missing), 'UNAUTHENTICATED')

    const garbage = await call('GET', '/auth/me', { token: 'not.a.jwt' })
    assert.equal(garbage.status, 401)
    assert.equal(errorCode(garbage), 'TOKEN_INVALID')
  })

  it('returns the full profile for /auth/me', async () => {
    db.users.get(USER_ID)!.branchIds = [BRANCH]
    const session = await login()
    const me = await call('GET', '/auth/me', { token: session.body.accessToken })

    assert.equal(me.status, 200)
    assert.equal(me.body.data.organization.name, 'Org A')
    assert.deepEqual(me.body.data.roles, ['admin'])
    assert.equal(me.body.data.branches[0].code, 'A1')
    assert.ok(Array.isArray(me.body.data.permissions))
    assert.ok(!me.text.includes('passwordHash'))
  })

  it('rejects an existing token once the account is suspended', async () => {
    const session = await login()
    const before = await call('GET', '/auth/me', { token: session.body.accessToken })
    assert.equal(before.status, 200)

    db.users.get(USER_ID)!.status = 'SUSPENDED'

    const after = await call('GET', '/auth/me', { token: session.body.accessToken })
    assert.equal(after.status, 401)
  })

  it('ignores a role claim in the token: permissions come from the database', async () => {
    // A user who is only a standard user forges nothing here, but the token role is never trusted.
    const plainId = oid(106)
    db.users.set(
      plainId,
      makeUser({
        id: plainId,
        email: 'plain@example.com',
        passwordHash,
        role: 'USER',
        organizationId: ORG,
      }),
    )
    const token = signAccessToken({ sub: plainId, role: 'SUPER_ADMIN' }).token

    const result = await call('GET', '/organizations', { token })

    assert.equal(result.status, 403)
    assert.equal(errorCode(result), 'FORBIDDEN')
  })

  it('logs out, revokes the refresh session and records the audit event', async () => {
    const session = await login()
    const cookie = session.setCookie?.split(';')[0]
    assert.ok(cookie?.startsWith('fleet_refresh='))

    const loggedOut = await call('POST', '/auth/logout', { cookie, body: {} })
    assert.equal(loggedOut.status, 200)
    assert.ok(db.auditEvents.some((event) => event.action === 'auth.logout'))

    // The revoked refresh token can no longer be exchanged.
    const refreshed = await call('POST', '/auth/refresh', { cookie, body: {} })
    assert.equal(refreshed.status, 401)
  })
})
