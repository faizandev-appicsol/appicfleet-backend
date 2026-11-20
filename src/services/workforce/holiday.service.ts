import { ENTITY_ACTIVE_STATUSES } from '../../constants/workforce.js'
import {
  findHolidayById,
  insertHoliday,
  listHolidays,
  updateHoliday,
} from '../../repositories/workforce/workforce.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { notFound } from '../../utils/httpErrors.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
} from '../audit/audit.service.js'
import { requireWorkforceOrganization } from './workforce-access.js'
import { parseWorkforcePage } from './workforce-paging.js'

export async function createHoliday(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId?: string
    branchId?: string
    name: string
    nameAr?: string
    date: string
    country?: string
    recurring?: boolean
  },
  meta?: RequestMeta,
) {
  const organizationId = await requireWorkforceOrganization(ctx, body.organizationId)
  const holiday = await insertHoliday({
    organizationId,
    legalEntityId: body.legalEntityId,
    branchId: body.branchId,
    name: body.name,
    nameAr: body.nameAr,
    date: body.date,
    country: body.country?.toUpperCase(),
    recurring: body.recurring ?? false,
    status: ENTITY_ACTIVE_STATUSES.ACTIVE,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.HOLIDAY_CREATED,
    entityType: AUDIT_ENTITY_TYPES.HOLIDAY,
    entityId: holiday.id,
    organizationId,
    branchId: body.branchId,
    meta,
  })
  return holiday
}

export async function updateHolidayService(
  ctx: AccessContext,
  id: string,
  body: Record<string, unknown>,
  meta?: RequestMeta,
) {
  const existing = await findHolidayById(id)
  if (!existing) throw notFound('Holiday was not found.')
  await requireWorkforceOrganization(ctx, existing.organizationId)
  const updated = await updateHoliday(id, { ...body, updatedBy: ctx.userId })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.HOLIDAY_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.HOLIDAY,
    entityId: id,
    organizationId: existing.organizationId,
    meta,
  })
  return updated
}

export async function listHolidaysService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    fromDate?: string
    toDate?: string
    branchId?: string
    status?: string
    page: number
    pageSize: number
  },
) {
  const organizationId = await requireWorkforceOrganization(ctx, query.organizationId)
  const { skip, pageSize } = parseWorkforcePage(query)
  return listHolidays({
    organizationId,
    fromDate: query.fromDate,
    toDate: query.toDate,
    branchId: query.branchId,
    status: query.status,
    skip,
    limit: pageSize,
  })
}
