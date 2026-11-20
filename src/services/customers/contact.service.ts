import { CONTACT_ROLES, CONTACT_STATUSES } from '../../constants/customers.js'
import {
  clearOtherPrimaryContacts,
  deactivateCustomerContact,
  findCustomerContact,
  insertCustomerContact,
  listCustomerContacts,
  updateCustomerContact,
  type CustomerContactRecord,
} from '../../repositories/customers/customer-contact.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  CreateCustomerContactBody,
  CustomerContactParams,
  ListCustomerContactsQuery,
  UpdateCustomerContactBody,
} from '../../validations/customer.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { canReveal, loadAccessibleCustomer } from './customer-access.js'
import { toContactResource, type CustomerContactResource } from './customer.mapper.js'

type ContactChange = 'create' | 'update' | 'deactivate'

async function auditContactChange(input: {
  ctx: AccessContext
  meta: RequestMeta
  customer: { id: string; organizationId: string; branchId: string }
  contact: CustomerContactRecord
  change: ContactChange
  changedFields?: string[]
}): Promise<void> {
  await recordAuditEvent({
    action: AUDIT_ACTIONS.CUSTOMER_CONTACT_CHANGE,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: input.customer.id,
    actorUserId: input.ctx.userId,
    organizationId: input.customer.organizationId,
    branchId: input.customer.branchId,
    // Names, phones, emails and license numbers are deliberately not logged.
    metadata: {
      change: input.change,
      contactId: input.contact.id,
      changedFields: input.changedFields,
    },
    meta: input.meta,
  })
}

export async function listContacts(
  ctx: AccessContext,
  customerId: string,
  query: ListCustomerContactsQuery,
) {
  const customer = await loadAccessibleCustomer(ctx, customerId)
  const pagination = resolvePagination(query)
  const reveal = canReveal(ctx, query.reveal)
  const result = await listCustomerContacts({
    customerId: customer.id,
    organizationId: customer.organizationId,
    skip: pagination.skip,
    take: pagination.take,
    status: query.status,
  })
  return toPaginated(
    result.items.map((contact) => toContactResource(contact, reveal)),
    pagination.page,
    pagination.limit,
    result.total,
  )
}

export async function createContact(
  ctx: AccessContext,
  customerId: string,
  input: CreateCustomerContactBody,
  meta: RequestMeta,
): Promise<CustomerContactResource> {
  const customer = await loadAccessibleCustomer(ctx, customerId)
  const contact = await insertCustomerContact({
    customerId: customer.id,
    organizationId: customer.organizationId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    role: input.role ?? CONTACT_ROLES.CONTACT,
    licenseNumber: input.licenseNumber,
    licenseExpiresOn: input.licenseExpiresOn,
    isPrimary: input.isPrimary ?? false,
  })
  if (contact.isPrimary) {
    await clearOtherPrimaryContacts(customer.id, customer.organizationId, contact.id)
  }
  await auditContactChange({ ctx, meta, customer, contact, change: 'create' })
  return toContactResource(contact, false)
}

export async function changeContact(
  ctx: AccessContext,
  params: CustomerContactParams,
  input: UpdateCustomerContactBody,
  meta: RequestMeta,
): Promise<CustomerContactResource> {
  const customer = await loadAccessibleCustomer(ctx, params.id)
  const existing = await findCustomerContact(customer.id, customer.organizationId, params.contactId)
  if (!existing) throw notFound('Contact was not found.')
  if (input.isPrimary === true && existing.status !== CONTACT_STATUSES.ACTIVE) {
    throw invalidField('isPrimary', 'An inactive contact cannot be the primary contact')
  }

  const updated = await updateCustomerContact(
    customer.id,
    customer.organizationId,
    existing.id,
    input,
  )
  if (!updated) throw notFound('Contact was not found.')
  if (input.isPrimary === true) {
    await clearOtherPrimaryContacts(customer.id, customer.organizationId, updated.id)
  }

  await auditContactChange({
    ctx,
    meta,
    customer,
    contact: updated,
    change: 'update',
    changedFields: Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key),
  })
  return toContactResource(updated, false)
}

export async function deactivateContact(
  ctx: AccessContext,
  params: CustomerContactParams,
  meta: RequestMeta,
): Promise<CustomerContactResource> {
  const customer = await loadAccessibleCustomer(ctx, params.id)
  const existing = await findCustomerContact(customer.id, customer.organizationId, params.contactId)
  if (!existing) throw notFound('Contact was not found.')

  const deactivated = await deactivateCustomerContact(
    customer.id,
    customer.organizationId,
    existing.id,
  )
  if (!deactivated) throw conflict('Contact is already inactive.')

  await auditContactChange({ ctx, meta, customer, contact: deactivated, change: 'deactivate' })
  return toContactResource(deactivated, false)
}
