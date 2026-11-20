import {
  DEFAULT_CURRENCY,
  PAYMENT_TERMS,
  VENDOR_STATUSES,
  VENDOR_TYPES,
  type VendorStatus,
  type VendorType,
} from '../../constants/procurement.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import {
  allocateProcurementNumber,
  emitAccountingSourceEvent,
  findVendorById,
  insertVendor,
  insertVendorDocument,
  listStatusEvents,
  listVendorContacts,
  listVendorDocuments,
  listVendors,
  listVendorBills,
  listLpos,
  listWorkOrders,
  recordStatusEvent,
  replaceVendorContacts,
  updateVendor,
  type VendorRecord,
} from '../../repositories/procurement/procurement.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { addMoney } from '../../utils/money.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess } from '../authorization/authorization.service.js'
import {
  isOrganizationWide,
  loadAccessibleVendor,
  resolveProcurementOrganization,
} from './procurement-access.js'
import { toLpoResource, toVendorResource, toWorkOrderResource } from './procurement.mapper.js'

type CreateVendorBody = {
  organizationId?: string
  legalEntityId: string
  branchId: string
  name: string
  vendorType: string
  partyKind?: string
  phone?: string
  email?: string
  addressLine1?: string
  city?: string
  country?: string
  taxRegistration?: string
  paymentTerms?: string
  customPaymentDays?: number
  notes?: string
  contacts?: Array<{ role: string; name: string; phone?: string; email?: string; isPrimary?: boolean }>
}

type ListQuery = {
  organizationId?: string
  search?: string
  status?: string
  vendorType?: string
  branchId?: string
  legalEntityId?: string
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  limit?: number
}

async function audit(
  action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
  vendor: VendorRecord,
  actorUserId: string | undefined,
  meta: RequestMeta | undefined,
  metadata: Record<string, unknown>,
) {
  await recordAuditEvent({
    action,
    entityType: AUDIT_ENTITY_TYPES.VENDOR,
    entityId: vendor.id,
    actorUserId,
    organizationId: vendor.organizationId,
    branchId: vendor.branchId,
    metadata,
    meta,
  })
}

export async function listVendorDirectory(ctx: AccessContext, query: ListQuery) {
  assertPermission(ctx, PERMISSIONS.VENDOR_VIEW)
  const organizationId = resolveProcurementOrganization(ctx, query.organizationId)
  if (query.branchId && !hasBranchAccess(ctx, query.branchId, organizationId)) throw notFound('Branch was not found.')
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listVendors({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search,
    status: query.status?.toUpperCase() as VendorStatus | undefined,
    vendorType: query.vendorType?.toUpperCase() as VendorType | undefined,
    branchId: query.branchId,
    legalEntityId: query.legalEntityId,
    sort: (query.sort as 'createdAt') ?? 'createdAt',
    order: query.order ?? 'desc',
  })
  return toPaginated(page.items.map(toVendorResource), pagination.page, pagination.limit, page.total)
}

export async function getVendor(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.VENDOR_VIEW)
  const vendor = await loadAccessibleVendor(ctx, id)
  const [contacts, documents, history, bills, lpos, workOrders] = await Promise.all([
    listVendorContacts(vendor.id),
    listVendorDocuments(vendor.id),
    listStatusEvents('vendor', vendor.id),
    listVendorBills({
      organizationId: vendor.organizationId,
      vendorId: vendor.id,
      skip: 0,
      take: 20,
      sort: 'createdAt',
      order: 'desc',
    }),
    listLpos({
      organizationId: vendor.organizationId,
      vendorId: vendor.id,
      skip: 0,
      take: 20,
      sort: 'createdAt',
      order: 'desc',
    }),
    listWorkOrders({
      organizationId: vendor.organizationId,
      vendorId: vendor.id,
      skip: 0,
      take: 20,
      sort: 'createdAt',
      order: 'desc',
    }),
  ])
  return {
    ...toVendorResource(vendor),
    contacts: contacts.map((row) => ({
      id: String(row._id),
      role: toPublicEnum(String(row.role)),
      name: String(row.name),
      phone: row.phone ? String(row.phone) : undefined,
      email: row.email ? String(row.email) : undefined,
      isPrimary: Boolean(row.isPrimary),
    })),
    documents: documents.map((row) => ({
      id: String(row._id),
      documentType: String(row.documentType),
      fileName: String(row.fileName),
      expiresAt: row.expiresAt ? new Date(row.expiresAt as Date).toISOString() : undefined,
      createdAt: row.createdAt ? new Date(row.createdAt as Date).toISOString() : undefined,
    })),
    financial: {
      billedCount: bills.total,
      lpoCount: lpos.total,
      workOrderCount: workOrders.total,
      totalBilled: bills.items.reduce((s, r) => addMoney(s, r.totalAmount), '0.00'),
      totalPaid: bills.items.reduce((s, r) => addMoney(s, r.paidAmount), '0.00'),
    },
    lpos: lpos.items.map(toLpoResource),
    workOrders: workOrders.items.map(toWorkOrderResource),
    history: history.map((row) => ({
      id: String(row._id),
      fromStatus: row.fromStatus ? toPublicEnum(String(row.fromStatus)) : undefined,
      toStatus: toPublicEnum(String(row.toStatus)),
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: row.createdAt ? new Date(row.createdAt as Date).toISOString() : undefined,
    })),
  }
}

export async function createVendor(ctx: AccessContext, body: CreateVendorBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.VENDOR_CREATE)
  const organizationId = resolveProcurementOrganization(ctx, body.organizationId)
  if (!hasBranchAccess(ctx, body.branchId, organizationId)) throw notFound('Branch was not found.')
  const vendorType = body.vendorType.toUpperCase() as VendorType
  if (!Object.values(VENDOR_TYPES).includes(vendorType)) throw invalidField('vendorType', 'Unsupported vendor type.')
  const paymentTerms = (body.paymentTerms ?? PAYMENT_TERMS.NET_30).toUpperCase()
  if (!Object.values(PAYMENT_TERMS).includes(paymentTerms as (typeof PAYMENT_TERMS)[keyof typeof PAYMENT_TERMS])) {
    throw invalidField('paymentTerms', 'Unsupported payment terms.')
  }
  const vendorCode = await allocateProcurementNumber(organizationId, 'vendor')
  const vendor = await insertVendor({
    organizationId,
    legalEntityId: body.legalEntityId,
    branchId: body.branchId,
    vendorCode,
    name: body.name,
    vendorType,
    partyKind: (body.partyKind ?? 'COMPANY').toUpperCase(),
    status: VENDOR_STATUSES.ACTIVE,
    phone: body.phone,
    email: body.email,
    addressLine1: body.addressLine1,
    city: body.city,
    country: body.country?.toUpperCase(),
    taxRegistration: body.taxRegistration,
    paymentTerms,
    customPaymentDays: body.customPaymentDays,
    notes: body.notes,
    createdBy: ctx.userId,
  })
  if (body.contacts?.length) {
    await replaceVendorContacts(
      vendor.id,
      organizationId,
      body.contacts.map((c) => ({ ...c, role: c.role.toUpperCase() })),
    )
  }
  await recordStatusEvent({
    entityType: 'vendor',
    entityId: vendor.id,
    organizationId,
    branchId: vendor.branchId,
    toStatus: VENDOR_STATUSES.ACTIVE,
    reason: 'created',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId,
    eventType: 'vendor.created',
    entityType: 'vendor',
    entityId: vendor.id,
    idempotencyKey: `vendor.created:${vendor.id}`,
    payload: { vendorId: vendor.id, vendorCode, currency: DEFAULT_CURRENCY },
  })
  await audit(AUDIT_ACTIONS.VENDOR_CREATE, vendor, ctx.userId, meta, { vendorCode })
  return getVendor(ctx, vendor.id)
}

export async function updateVendorRecord(
  ctx: AccessContext,
  id: string,
  body: Partial<CreateVendorBody> & { status?: string },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.VENDOR_EDIT)
  const existing = await loadAccessibleVendor(ctx, id)
  const patch: Record<string, unknown> = { updatedBy: ctx.userId }
  if (body.name) patch.name = body.name
  if (body.vendorType) patch.vendorType = body.vendorType.toUpperCase()
  if (body.partyKind) patch.partyKind = body.partyKind.toUpperCase()
  if (body.phone !== undefined) patch.phone = body.phone
  if (body.email !== undefined) patch.email = body.email
  if (body.addressLine1 !== undefined) patch.addressLine1 = body.addressLine1
  if (body.city !== undefined) patch.city = body.city
  if (body.country !== undefined) patch.country = body.country?.toUpperCase()
  if (body.taxRegistration !== undefined) patch.taxRegistration = body.taxRegistration
  if (body.paymentTerms) patch.paymentTerms = body.paymentTerms.toUpperCase()
  if (body.customPaymentDays !== undefined) patch.customPaymentDays = body.customPaymentDays
  if (body.notes !== undefined) patch.notes = body.notes
  if (body.status) {
    const status = body.status.toUpperCase() as VendorStatus
    if (!Object.values(VENDOR_STATUSES).includes(status)) throw invalidField('status', 'Unsupported vendor status.')
    patch.status = status
  }
  const updated = await updateVendor(existing.id, patch)
  if (!updated) throw conflict('Vendor could not be updated.')
  if (body.contacts) {
    await replaceVendorContacts(
      existing.id,
      existing.organizationId,
      body.contacts.map((c) => ({ ...c, role: c.role.toUpperCase() })),
    )
  }
  await audit(AUDIT_ACTIONS.VENDOR_UPDATE, updated, ctx.userId, meta, { fields: Object.keys(patch) })
  return getVendor(ctx, updated.id)
}

export async function disableVendor(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.VENDOR_DISABLE)
  const existing = await loadAccessibleVendor(ctx, id)
  if (existing.status === VENDOR_STATUSES.INACTIVE) throw conflict('Vendor is already inactive.')
  const updated = await updateVendor(existing.id, { status: VENDOR_STATUSES.INACTIVE, updatedBy: ctx.userId })
  if (!updated) throw conflict('Vendor could not be disabled.')
  await recordStatusEvent({
    entityType: 'vendor',
    entityId: existing.id,
    organizationId: existing.organizationId,
    branchId: existing.branchId,
    fromStatus: existing.status,
    toStatus: VENDOR_STATUSES.INACTIVE,
    reason,
    actorUserId: ctx.userId,
  })
  await audit(AUDIT_ACTIONS.VENDOR_DISABLE, updated, ctx.userId, meta, { reason })
  return getVendor(ctx, updated.id)
}

export async function addVendorDocumentMeta(
  ctx: AccessContext,
  vendorId: string,
  body: { documentType: string; fileName: string; storageKey: string; mimeType?: string; expiresAt?: Date; notes?: string },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.VENDOR_EDIT)
  const vendor = await loadAccessibleVendor(ctx, vendorId)
  const doc = await insertVendorDocument({
    vendorId: vendor.id,
    organizationId: vendor.organizationId,
    documentType: body.documentType,
    fileName: body.fileName,
    storageKey: body.storageKey,
    mimeType: body.mimeType,
    expiresAt: body.expiresAt,
    notes: body.notes,
    createdBy: ctx.userId,
  })
  await audit(AUDIT_ACTIONS.VENDOR_UPDATE, vendor, ctx.userId, meta, { documentId: String(doc._id) })
  return getVendor(ctx, vendor.id)
}

export async function requireActiveVendor(ctx: AccessContext, vendorId: string) {
  const vendor = await loadAccessibleVendor(ctx, vendorId)
  if (vendor.status === VENDOR_STATUSES.BLOCKED) throw conflict('Vendor is blocked.')
  if (vendor.status === VENDOR_STATUSES.INACTIVE) throw conflict('Vendor is inactive.')
  return vendor
}

export { findVendorById }
