import type { FilterQuery } from 'mongoose'
import {
  CONTACT_STATUSES,
  type ContactRole,
  type ContactStatus,
} from '../../constants/customers.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import type { ICustomerContact } from '../../interfaces/customer.interface.js'
import { CustomerContact } from '../../models/customer-contact.model.js'
import { omitUndefined, toObjectId } from '../object-id.js'

export type CustomerContactRecord = {
  id: string
  customerId: string
  organizationId: string
  name: string
  phone?: string
  email?: string
  role: ContactRole
  /** Raw value. Mask before returning it from the API. */
  licenseNumber?: string
  licenseExpiresOn?: Date
  isPrimary: boolean
  status: ContactStatus
  createdAt: Date
  updatedAt: Date
}

type PersistableContact = {
  _id: { toString(): string }
  customerId: { toString(): string }
  organizationId: { toString(): string }
  name: string
  phone?: string | null
  email?: string | null
  role: string
  licenseNumber?: string | null
  licenseExpiresOn?: Date | null
  isPrimary: boolean
  status: string
  createdAt: Date
  updatedAt: Date
}

function toRecord(doc: PersistableContact): CustomerContactRecord {
  return {
    id: doc._id.toString(),
    customerId: doc.customerId.toString(),
    organizationId: doc.organizationId.toString(),
    name: doc.name,
    phone: doc.phone ?? undefined,
    email: doc.email ?? undefined,
    role: doc.role as ContactRole,
    licenseNumber: doc.licenseNumber ?? undefined,
    licenseExpiresOn: doc.licenseExpiresOn ?? undefined,
    isPrimary: doc.isPrimary,
    status: doc.status as ContactStatus,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export async function listCustomerContacts(input: {
  customerId: string
  organizationId: string
  skip: number
  take: number
  status?: ContactStatus
}): Promise<{ items: CustomerContactRecord[]; total: number }> {
  const customerId = toObjectId(input.customerId)
  const organizationId = toObjectId(input.organizationId)
  if (!customerId || !organizationId) return { items: [], total: 0 }

  const filter: FilterQuery<ICustomerContact> = { customerId, organizationId }
  if (input.status) filter.status = input.status

  const [items, total] = await Promise.all([
    CustomerContact.find(filter)
      .sort({ isPrimary: -1, createdAt: 1, _id: 1 })
      .skip(input.skip)
      .limit(input.take)
      .lean(),
    CustomerContact.countDocuments(filter),
  ])
  return { items: items.map(toRecord), total }
}

/** Scoped by customer and organization; a contact id from another customer never matches. */
export async function findCustomerContact(
  customerId: string,
  organizationId: string,
  contactId: string,
): Promise<CustomerContactRecord | null> {
  const customerObjectId = toObjectId(customerId)
  const orgId = toObjectId(organizationId)
  const id = toObjectId(contactId)
  if (!customerObjectId || !orgId || !id) return null
  const doc = await CustomerContact.findOne({
    _id: id,
    customerId: customerObjectId,
    organizationId: orgId,
  }).lean()
  return doc ? toRecord(doc) : null
}

export type NewCustomerContact = {
  customerId: string
  organizationId: string
  name: string
  phone?: string
  email?: string
  role: ContactRole
  licenseNumber?: string
  licenseExpiresOn?: Date
  isPrimary: boolean
}

export async function insertCustomerContact(
  input: NewCustomerContact,
): Promise<CustomerContactRecord> {
  try {
    const doc = await CustomerContact.create({
      ...omitUndefined({ ...input }),
      customerId: toObjectId(input.customerId),
      organizationId: toObjectId(input.organizationId),
      status: CONTACT_STATUSES.ACTIVE,
    })
    return toRecord(doc)
  } catch (error) {
    rethrowDatabaseError(error, 'The contact could not be saved.')
  }
}

/** `null` clears an optional field; `undefined` leaves it untouched. */
export type CustomerContactUpdate = {
  name?: string
  phone?: string | null
  email?: string | null
  role?: ContactRole
  licenseNumber?: string | null
  licenseExpiresOn?: Date | null
  isPrimary?: boolean
}

export async function updateCustomerContact(
  customerId: string,
  organizationId: string,
  contactId: string,
  input: CustomerContactUpdate,
): Promise<CustomerContactRecord | null> {
  const customerObjectId = toObjectId(customerId)
  const orgId = toObjectId(organizationId)
  const id = toObjectId(contactId)
  if (!customerObjectId || !orgId || !id) return null

  const $set: Record<string, unknown> = {}
  const $unset: Record<string, ''> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue
    if (value === null) $unset[key] = ''
    else $set[key] = value
  }
  const update: Record<string, unknown> = {}
  if (Object.keys($set).length > 0) update.$set = $set
  if (Object.keys($unset).length > 0) update.$unset = $unset
  if (Object.keys(update).length === 0) {
    return findCustomerContact(customerId, organizationId, contactId)
  }

  try {
    const doc = await CustomerContact.findOneAndUpdate(
      { _id: id, customerId: customerObjectId, organizationId: orgId },
      update,
      { new: true, runValidators: true },
    ).lean()
    return doc ? toRecord(doc) : null
  } catch (error) {
    rethrowDatabaseError(error, 'The contact could not be saved.')
  }
}

/** Compare-and-set: returns null when the contact is missing or already inactive. */
export async function deactivateCustomerContact(
  customerId: string,
  organizationId: string,
  contactId: string,
): Promise<CustomerContactRecord | null> {
  const customerObjectId = toObjectId(customerId)
  const orgId = toObjectId(organizationId)
  const id = toObjectId(contactId)
  if (!customerObjectId || !orgId || !id) return null
  const doc = await CustomerContact.findOneAndUpdate(
    {
      _id: id,
      customerId: customerObjectId,
      organizationId: orgId,
      status: CONTACT_STATUSES.ACTIVE,
    },
    { $set: { status: CONTACT_STATUSES.INACTIVE, isPrimary: false } },
    { new: true },
  ).lean()
  return doc ? toRecord(doc) : null
}

/** Only one contact per customer is primary: clears the flag on every other contact. */
export async function clearOtherPrimaryContacts(
  customerId: string,
  organizationId: string,
  keepContactId: string,
): Promise<void> {
  const customerObjectId = toObjectId(customerId)
  const orgId = toObjectId(organizationId)
  const keepId = toObjectId(keepContactId)
  if (!customerObjectId || !orgId || !keepId) return
  await CustomerContact.updateMany(
    { customerId: customerObjectId, organizationId: orgId, _id: { $ne: keepId }, isPrimary: true },
    { $set: { isPrimary: false } },
  )
}
