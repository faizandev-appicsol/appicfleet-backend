import {
  ACCOUNT_TYPES,
  DEFAULT_CHART_SEED,
  type AccountType,
} from '../../constants/accounting.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  findAccountByCode,
  insertAccount,
  listAccounts,
  listAllAccounts,
  updateAccount,
  upsertAccountMapping,
} from '../../repositories/accounting/accounting.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { normalBalanceForType, wouldCreateAccountCycle } from './accounting-rules.js'
import { loadAccessibleAccount, resolveAccountingOrganization } from './accounting-access.js'
import { toAccountResource } from './accounting.mapper.js'

export async function listAccountDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_VIEW)
  const organizationId = resolveAccountingOrganization(ctx, query.organizationId as string | undefined)
  const pagination = resolvePagination(query)
  const page = await listAccounts({
    organizationId,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search as string | undefined,
    accountType: query.accountType ? (String(query.accountType).toUpperCase() as AccountType) : undefined,
    isActive: query.isActive === undefined ? undefined : String(query.isActive) === 'true',
    sort: (query.sort as 'code') ?? 'code',
    order: (query.order as 'asc' | 'desc') ?? 'asc',
  })
  return toPaginated(page.items.map(toAccountResource), pagination.page, pagination.limit, page.total)
}

export async function listAccountTree(ctx: AccessContext, organizationId?: string) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_VIEW)
  const orgId = resolveAccountingOrganization(ctx, organizationId)
  const accounts = await listAllAccounts(orgId)
  return accounts.map(toAccountResource)
}

export async function getAccount(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_VIEW)
  return toAccountResource(await loadAccessibleAccount(ctx, id))
}

export async function createAccount(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId?: string
    code: string
    name: string
    accountType: string
    parentAccountId?: string
    description?: string
    systemRole?: string
    isSystem?: boolean
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_MANAGE_ACCOUNTS)
  const organizationId = resolveAccountingOrganization(ctx, body.organizationId)
  const accountType = body.accountType.toUpperCase() as AccountType
  if (!(Object.values(ACCOUNT_TYPES) as string[]).includes(accountType)) {
    throw invalidField('accountType', 'Unsupported account type.')
  }
  const existing = await findAccountByCode(organizationId, body.code)
  if (existing) throw conflict('An account with this code already exists.')

  if (body.parentAccountId) {
    const parent = await loadAccessibleAccount(ctx, body.parentAccountId)
    if (parent.organizationId !== organizationId) throw notFound('Parent account was not found.')
  }

  const account = await insertAccount({
    organizationId,
    legalEntityId: body.legalEntityId,
    code: body.code.trim().toUpperCase(),
    name: body.name.trim(),
    accountType,
    normalBalance: normalBalanceForType(accountType),
    parentAccountId: body.parentAccountId,
    description: body.description,
    isSystem: Boolean(body.isSystem || body.systemRole),
    systemRole: body.systemRole?.toUpperCase(),
    isActive: true,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.ACCOUNT_CREATE,
    entityType: AUDIT_ENTITY_TYPES.GL_ACCOUNT,
    entityId: account.id,
    actorUserId: ctx.userId,
    organizationId,
    metadata: { code: account.code },
    meta,
  })
  return toAccountResource(account)
}

export async function updateAccountRecord(
  ctx: AccessContext,
  id: string,
  body: Partial<{
    name: string
    description: string
    parentAccountId: string | null
    isActive: boolean
  }>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_MANAGE_ACCOUNTS)
  const existing = await loadAccessibleAccount(ctx, id)
  if (body.parentAccountId) {
    const all = await listAllAccounts(existing.organizationId)
    const parentById = new Map(all.map((row) => [row.id, row.parentAccountId]))
    if (wouldCreateAccountCycle(existing.id, body.parentAccountId, parentById)) {
      throw invalidField('parentAccountId', 'Parent account would create a circular hierarchy.')
    }
  }
  const updated = await updateAccount(existing.id, {
    name: body.name?.trim(),
    description: body.description,
    parentAccountId: body.parentAccountId === undefined ? undefined : body.parentAccountId,
    isActive: body.isActive,
    updatedBy: ctx.userId,
  })
  if (!updated) throw conflict('Account could not be updated.')
  await recordAuditEvent({
    action: body.isActive === false ? AUDIT_ACTIONS.ACCOUNT_DISABLE : AUDIT_ACTIONS.ACCOUNT_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.GL_ACCOUNT,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    metadata: { fields: Object.keys(body) },
    meta,
  })
  return toAccountResource(updated)
}

/** Seeds default chart + role mappings for a legal entity. Idempotent by account code. */
export async function seedDefaultChart(
  ctx: AccessContext,
  body: { organizationId?: string; legalEntityId: string },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_MANAGE_ACCOUNTS)
  const organizationId = resolveAccountingOrganization(ctx, body.organizationId)
  const codeToId = new Map<string, string>()
  let created = 0

  for (const seed of DEFAULT_CHART_SEED) {
    const existing = await findAccountByCode(organizationId, seed.code)
    if (existing) {
      codeToId.set(seed.code, existing.id)
      continue
    }
    const parentAccountId = seed.parentCode ? codeToId.get(seed.parentCode) : undefined
    const account = await insertAccount({
      organizationId,
      legalEntityId: body.legalEntityId,
      code: seed.code,
      name: seed.name,
      accountType: seed.accountType,
      normalBalance: normalBalanceForType(seed.accountType),
      parentAccountId,
      isSystem: Boolean(seed.role),
      systemRole: seed.role,
      isActive: true,
      createdBy: ctx.userId,
    })
    codeToId.set(seed.code, account.id)
    created += 1
    if (seed.role) {
      await upsertAccountMapping({
        organizationId,
        legalEntityId: body.legalEntityId,
        role: seed.role,
        accountId: account.id,
        updatedBy: ctx.userId,
      })
    }
  }

  await recordAuditEvent({
    action: AUDIT_ACTIONS.CHART_SEED,
    entityType: AUDIT_ENTITY_TYPES.GL_ACCOUNT,
    actorUserId: ctx.userId,
    organizationId,
    metadata: { created, legalEntityId: body.legalEntityId },
    meta,
  })
  return { created, total: DEFAULT_CHART_SEED.length }
}
