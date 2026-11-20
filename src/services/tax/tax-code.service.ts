import { DEFAULT_TAX_CODE_SEEDS } from '../../constants/tax.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  findActiveTaxRate,
  findTaxCodeByCode,
  findTaxCodeById,
  insertTaxCode,
  insertTaxRate,
  listTaxCodes,
  listTaxRates,
  updateTaxCode,
} from '../../repositories/tax/tax.repository.js'
import type { AccessContext } from '../../types/access.js'
import type { RequestMeta } from '../../types/http.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { resolveTaxOrganization } from './tax-access.js'
import { toTaxCodeResource, toTaxRateResource } from './tax.mapper.js'

export async function listTaxCodeDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.TAX_VIEW)
  const organizationId = resolveTaxOrganization(ctx, query.organizationId as string | undefined)
  const pagination = resolvePagination(query)
  const filter: Record<string, unknown> = { organizationId }
  if (query.isActive === true || query.isActive === false) filter.isActive = query.isActive
  if (typeof query.search === 'string' && query.search.trim()) {
    filter.$or = [
      { code: new RegExp(query.search.trim(), 'i') },
      { name: new RegExp(query.search.trim(), 'i') },
    ]
  }
  const page = await listTaxCodes(filter, pagination.skip, pagination.take)
  return toPaginated(page.items.map(toTaxCodeResource), pagination.page, pagination.limit, page.total)
}

export async function createTaxCode(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId?: string
    code: string
    name: string
    description?: string
    treatment: string
    ratePercent: string
    effectiveFrom: Date
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.TAX_MANAGE_CODES)
  const organizationId = resolveTaxOrganization(ctx, body.organizationId)
  const code = body.code.trim().toUpperCase()
  if (await findTaxCodeByCode(organizationId, code)) throw conflict('Tax code already exists.')
  const created = await insertTaxCode({
    organizationId,
    legalEntityId: body.legalEntityId,
    code,
    name: body.name.trim(),
    description: body.description,
    treatment: body.treatment.toUpperCase(),
    isActive: true,
    isSystem: false,
    createdBy: ctx.userId,
  })
  await insertTaxRate({
    organizationId,
    taxCodeId: created.id,
    ratePercent: body.ratePercent,
    effectiveFrom: body.effectiveFrom,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.TAX_CODE_CREATE,
    entityType: AUDIT_ENTITY_TYPES.TAX_CODE,
    entityId: created.id,
    actorUserId: ctx.userId,
    organizationId,
    meta,
    metadata: { code },
  })
  return toTaxCodeResource(created)
}

export async function updateTaxCodeRecord(
  ctx: AccessContext,
  id: string,
  body: { name?: string; description?: string; isActive?: boolean },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.TAX_MANAGE_CODES)
  const row = await findTaxCodeById(id)
  if (!row) throw notFound('Tax code was not found.')
  resolveTaxOrganization(ctx, String(row.organizationId))
  const updated = await updateTaxCode(id, {
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    updatedBy: ctx.userId,
  })
  if (!updated) throw notFound('Tax code was not found.')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.TAX_CODE_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.TAX_CODE,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: String(row.organizationId),
    meta,
  })
  return toTaxCodeResource(updated)
}

export async function addTaxRate(
  ctx: AccessContext,
  taxCodeId: string,
  body: { ratePercent: string; effectiveFrom: Date; effectiveTo?: Date },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.TAX_MANAGE_CODES)
  const code = await findTaxCodeById(taxCodeId)
  if (!code) throw notFound('Tax code was not found.')
  const organizationId = resolveTaxOrganization(ctx, String(code.organizationId))
  if (body.effectiveTo && body.effectiveTo <= body.effectiveFrom) {
    throw invalidField('effectiveTo', 'effectiveTo must be after effectiveFrom.')
  }
  const rate = await insertTaxRate({
    organizationId,
    taxCodeId,
    ratePercent: body.ratePercent,
    effectiveFrom: body.effectiveFrom,
    effectiveTo: body.effectiveTo,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.TAX_RATE_CREATE,
    entityType: AUDIT_ENTITY_TYPES.TAX_CODE,
    entityId: taxCodeId,
    actorUserId: ctx.userId,
    organizationId,
    meta,
    metadata: { ratePercent: body.ratePercent },
  })
  return toTaxRateResource(rate)
}

export async function getTaxCodeRates(ctx: AccessContext, taxCodeId: string) {
  assertPermission(ctx, PERMISSIONS.TAX_VIEW)
  const code = await findTaxCodeById(taxCodeId)
  if (!code) throw notFound('Tax code was not found.')
  resolveTaxOrganization(ctx, String(code.organizationId))
  return (await listTaxRates(taxCodeId)).map(toTaxRateResource)
}

export async function seedDefaultTaxCodes(
  ctx: AccessContext,
  body: { organizationId?: string; legalEntityId?: string },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.TAX_MANAGE_CODES)
  const organizationId = resolveTaxOrganization(ctx, body.organizationId)
  let created = 0
  for (const seed of DEFAULT_TAX_CODE_SEEDS) {
    if (await findTaxCodeByCode(organizationId, seed.code)) continue
    const code = await insertTaxCode({
      organizationId,
      legalEntityId: body.legalEntityId,
      code: seed.code,
      name: seed.name,
      description: seed.description,
      treatment: seed.treatment,
      isActive: true,
      isSystem: true,
      createdBy: ctx.userId,
    })
    await insertTaxRate({
      organizationId,
      taxCodeId: code.id,
      ratePercent: seed.ratePercent,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      createdBy: ctx.userId,
    })
    created += 1
  }
  await recordAuditEvent({
    action: AUDIT_ACTIONS.TAX_CODES_SEED,
    entityType: AUDIT_ENTITY_TYPES.TAX_CODE,
    actorUserId: ctx.userId,
    organizationId,
    meta,
    metadata: { created },
  })
  return { created, total: DEFAULT_TAX_CODE_SEEDS.length }
}

export async function resolveRateForCode(organizationId: string, taxCodeId: string, at: Date) {
  const rate = await findActiveTaxRate(organizationId, taxCodeId, at)
  if (!rate) throw invalidField('taxCodeId', 'No effective tax rate for this code on the document date.')
  return rate
}
