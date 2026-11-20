import type { FilterQuery, SortOrder } from 'mongoose'
import type {
  CustomerDocumentStatus,
  CustomerSortField,
  CustomerStatus,
  CustomerType,
} from '../../constants/customers.js'
import { ERROR_CODES } from '../../exceptions/errorCodes.js'
import { AppError } from '../../exceptions/AppError.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import type {
  ICustomer,
  ICustomerAddress,
  ICustomerCorporate,
  ICustomerIndividual,
} from '../../interfaces/customer.interface.js'
import { Customer } from '../../models/customer.model.js'
import { CustomerOcrRun } from '../../models/customer-ocr-run.model.js'
import { escapeRegex, omitUndefined, toObjectId, toObjectIds } from '../object-id.js'

export type CustomerRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  customerNumber: string
  type: CustomerType
  status: CustomerStatus
  displayName: string
  email?: string
  phone?: string
  alternatePhone?: string
  address?: ICustomerAddress
  notes?: string
  individual?: ICustomerIndividual
  corporate?: ICustomerCorporate
  normalizedEmail?: string
  normalizedPhone?: string
  documentStatus: CustomerDocumentStatus
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

type PersistableCustomer = {
  _id: { toString(): string }
  organizationId: { toString(): string }
  legalEntityId: { toString(): string }
  branchId: { toString(): string }
  customerNumber: string
  type: string
  status: string
  displayName: string
  email?: string | null
  phone?: string | null
  alternatePhone?: string | null
  address?: ICustomerAddress | null
  notes?: string | null
  individual?: ICustomerIndividual | null
  corporate?: ICustomerCorporate | null
  normalizedEmail?: string | null
  normalizedPhone?: string | null
  documentStatus: string
  createdBy: { toString(): string }
  createdAt: Date
  updatedAt: Date
}

function toAddress(value: ICustomerAddress | null | undefined): ICustomerAddress | undefined {
  if (!value) return undefined
  return { line1: value.line1, city: value.city, country: value.country }
}

function toIndividual(value: ICustomerIndividual | null | undefined): ICustomerIndividual | undefined {
  if (!value) return undefined
  return omitUndefined({
    firstName: value.firstName,
    middleName: value.middleName ?? undefined,
    lastName: value.lastName,
    dateOfBirth: value.dateOfBirth ?? undefined,
    nationality: value.nationality ?? undefined,
  }) as ICustomerIndividual
}

function toCorporate(value: ICustomerCorporate | null | undefined): ICustomerCorporate | undefined {
  if (!value) return undefined
  return omitUndefined({
    legalName: value.legalName,
    tradeName: value.tradeName ?? undefined,
    registrationNumber: value.registrationNumber ?? undefined,
    taxNumber: value.taxNumber ?? undefined,
  }) as ICustomerCorporate
}

function toRecord(doc: PersistableCustomer): CustomerRecord {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    legalEntityId: doc.legalEntityId.toString(),
    branchId: doc.branchId.toString(),
    customerNumber: doc.customerNumber,
    type: doc.type as CustomerType,
    status: doc.status as CustomerStatus,
    displayName: doc.displayName,
    email: doc.email ?? undefined,
    phone: doc.phone ?? undefined,
    alternatePhone: doc.alternatePhone ?? undefined,
    address: toAddress(doc.address),
    notes: doc.notes ?? undefined,
    individual: toIndividual(doc.individual),
    corporate: toCorporate(doc.corporate),
    normalizedEmail: doc.normalizedEmail ?? undefined,
    normalizedPhone: doc.normalizedPhone ?? undefined,
    documentStatus: doc.documentStatus as CustomerDocumentStatus,
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export async function findCustomerById(id: string): Promise<CustomerRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Customer.findById(objectId).lean()
  return doc ? toRecord(doc) : null
}

/** Scoped by organization; ids from another tenant never match. */
export async function findCustomersByIds(
  organizationId: string,
  ids: readonly string[],
): Promise<CustomerRecord[]> {
  const orgId = toObjectId(organizationId)
  const objectIds = toObjectIds(ids)
  if (!orgId || objectIds.length === 0) return []
  const docs = await Customer.find({ organizationId: orgId, _id: { $in: objectIds } }).lean()
  return docs.map(toRecord)
}

export type ListCustomersInput = {
  organizationId: string
  skip: number
  take: number
  search?: string
  status?: CustomerStatus
  type?: CustomerType
  documentStatus?: CustomerDocumentStatus
  /** Restricts the result to these branches (`$in`). Empty array matches nothing. */
  branchIds?: readonly string[]
  /** Restricts the result to these legal entities (`$in`). Empty array matches nothing. */
  legalEntityIds?: readonly string[]
  /**
   * When true, an exact company registration, tax number, or reviewed OCR value may match.
   * Only set for callers who may see sensitive identifiers. The term is never logged.
   */
  sensitiveSearch?: boolean
  sort: CustomerSortField
  order: 'asc' | 'desc'
}

export async function listCustomers(
  input: ListCustomersInput,
): Promise<{ items: CustomerRecord[]; total: number }> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }

  const filter: FilterQuery<ICustomer> = { organizationId }
  if (input.status) filter.status = input.status
  if (input.type) filter.type = input.type
  if (input.documentStatus) filter.documentStatus = input.documentStatus
  if (input.branchIds) filter.branchId = { $in: toObjectIds(input.branchIds) }
  if (input.legalEntityIds) filter.legalEntityId = { $in: toObjectIds(input.legalEntityIds) }
  if (input.search) {
    const pattern = { $regex: escapeRegex(input.search), $options: 'i' }
    const clauses: FilterQuery<ICustomer>[] = [
      { displayName: pattern },
      { customerNumber: pattern },
      { email: pattern },
      { phone: pattern },
      { 'corporate.legalName': pattern },
      { 'corporate.tradeName': pattern },
    ]
    const digits = input.search.replace(/\D/g, '')
    if (digits.length >= 3) clauses.push({ normalizedPhone: { $regex: escapeRegex(digits) } })
    if (input.sensitiveSearch && input.search.length >= 4) {
      const exact = input.search
      const registration = exact.toUpperCase()
      clauses.push({ 'corporate.registrationNumber': registration }, { 'corporate.taxNumber': exact })
      if (exact !== registration) clauses.push({ 'corporate.taxNumber': registration })
      const needles = exact === registration ? [exact] : [exact, registration]
      const matches = await CustomerOcrRun.find({
        organizationId,
        $or: needles.flatMap((value) => [
          { 'fields.value': value },
          { 'reviewedFields.value': value },
        ]),
      })
        .select('customerId')
        .limit(50)
        .lean()
      const customerIds = [
        ...new Set(matches.map((row) => String(row.customerId)).filter((id) => id.length > 0)),
      ]
      if (customerIds.length > 0) clauses.push({ _id: { $in: toObjectIds(customerIds) } })
    }
    filter.$or = clauses
  }

  const direction: SortOrder = input.order === 'asc' ? 1 : -1
  const sort: Record<string, SortOrder> = { [input.sort]: direction, _id: direction }

  try {
    const [items, total] = await Promise.all([
      Customer.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
      Customer.countDocuments(filter),
    ])
    return { items: items.map(toRecord), total }
  } catch (error) {
    rethrowDatabaseError(error, 'Customers could not be loaded.')
  }
}

export type NewCustomer = {
  organizationId: string
  legalEntityId: string
  branchId: string
  type: CustomerType
  displayName: string
  email?: string
  phone?: string
  alternatePhone?: string
  address?: ICustomerAddress
  notes?: string
  individual?: ICustomerIndividual
  corporate?: ICustomerCorporate
  normalizedEmail?: string
  normalizedPhone?: string
  createdBy: string
}

const CUSTOMER_NUMBER_PREFIX = 'CUS-'
const CUSTOMER_NUMBER_PATTERN = /^CUS-\d+$/
const CUSTOMER_NUMBER_ATTEMPTS = 5

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  )
}

/** Next `CUS-0001` style number for the organization (highest existing number + 1). */
async function nextCustomerNumber(organizationId: ReturnType<typeof toObjectId>): Promise<string> {
  const latest = await Customer.findOne({
    organizationId,
    customerNumber: CUSTOMER_NUMBER_PATTERN,
  })
    .collation({ locale: 'en', numericOrdering: true })
    .sort({ customerNumber: -1 })
    .select('customerNumber')
    .lean()
  const current = latest
    ? Number.parseInt(latest.customerNumber.slice(CUSTOMER_NUMBER_PREFIX.length), 10)
    : 0
  const next = Number.isFinite(current) ? current + 1 : 1
  return `${CUSTOMER_NUMBER_PREFIX}${String(next).padStart(4, '0')}`
}

/**
 * Allocates the customer number and inserts. Two racing creates can pick the same number; the
 * unique {organizationId, customerNumber} index rejects the loser, which simply retries.
 */
export async function createCustomer(input: NewCustomer): Promise<CustomerRecord> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) {
    throw new AppError('The identifier is invalid.', 400, ERROR_CODES.VALIDATION_ERROR)
  }

  for (let attempt = 1; attempt <= CUSTOMER_NUMBER_ATTEMPTS; attempt += 1) {
    const customerNumber = await nextCustomerNumber(organizationId)
    try {
      const doc = await Customer.create({
        ...omitUndefined({ ...input }),
        organizationId,
        legalEntityId: toObjectId(input.legalEntityId),
        branchId: toObjectId(input.branchId),
        createdBy: toObjectId(input.createdBy),
        customerNumber,
        individual: input.individual ? omitUndefined({ ...input.individual }) : undefined,
        corporate: input.corporate ? omitUndefined({ ...input.corporate }) : undefined,
      })
      return toRecord(doc)
    } catch (error) {
      if (isDuplicateKeyError(error) && attempt < CUSTOMER_NUMBER_ATTEMPTS) continue
      rethrowDatabaseError(error, 'A customer with this number already exists.')
    }
  }
  throw new AppError('A customer number could not be allocated.', 409, ERROR_CODES.CONFLICT)
}

/** `null` clears an optional field; `undefined` leaves it untouched. */
export type CustomerUpdate = {
  displayName?: string
  email?: string | null
  phone?: string | null
  alternatePhone?: string | null
  notes?: string | null
  normalizedEmail?: string | null
  normalizedPhone?: string | null
  address?: ICustomerAddress | null
  individual?: {
    firstName?: string
    middleName?: string | null
    lastName?: string
    dateOfBirth?: Date | null
    nationality?: string | null
  }
  corporate?: {
    legalName?: string
    tradeName?: string | null
    registrationNumber?: string | null
    taxNumber?: string | null
  }
}

function buildUpdate(input: CustomerUpdate): {
  $set: Record<string, unknown>
  $unset: Record<string, ''>
} {
  const { address, individual, corporate, ...plain } = input
  const $set: Record<string, unknown> = {}
  const $unset: Record<string, ''> = {}

  for (const [key, value] of Object.entries(plain)) {
    if (value === undefined) continue
    if (value === null) $unset[key] = ''
    else $set[key] = value
  }
  if (address === null) $unset.address = ''
  else if (address !== undefined) $set.address = { ...address }

  for (const [prefix, block] of [
    ['individual', individual],
    ['corporate', corporate],
  ] as const) {
    if (!block) continue
    for (const [key, value] of Object.entries(block)) {
      if (value === undefined) continue
      if (value === null) $unset[`${prefix}.${key}`] = ''
      else $set[`${prefix}.${key}`] = value
    }
  }
  return { $set, $unset }
}

const DUPLICATE_NUMBER_MESSAGE = 'A customer with this number already exists.'

/** Scoped by organizationId so a customer can never be updated through another tenant. */
export async function updateCustomer(
  id: string,
  organizationId: string,
  input: CustomerUpdate,
): Promise<CustomerRecord | null> {
  const objectId = toObjectId(id)
  const orgId = toObjectId(organizationId)
  if (!objectId || !orgId) return null

  const { $set, $unset } = buildUpdate(input)
  const update: Record<string, unknown> = {}
  if (Object.keys($set).length > 0) update.$set = $set
  if (Object.keys($unset).length > 0) update.$unset = $unset
  if (Object.keys(update).length === 0) return findCustomerById(id)

  try {
    const doc = await Customer.findOneAndUpdate({ _id: objectId, organizationId: orgId }, update, {
      new: true,
      runValidators: true,
    }).lean()
    return doc ? toRecord(doc) : null
  } catch (error) {
    rethrowDatabaseError(error, DUPLICATE_NUMBER_MESSAGE)
  }
}

/**
 * Compare-and-set status change: succeeds only if the customer is still in `from`.
 * Returns null when the customer is gone or its status changed concurrently.
 */
export async function transitionCustomerStatus(
  id: string,
  organizationId: string,
  from: CustomerStatus,
  to: CustomerStatus,
): Promise<CustomerRecord | null> {
  const objectId = toObjectId(id)
  const orgId = toObjectId(organizationId)
  if (!objectId || !orgId) return null
  const doc = await Customer.findOneAndUpdate(
    { _id: objectId, organizationId: orgId, status: from },
    { $set: { status: to } },
    { new: true },
  ).lean()
  return doc ? toRecord(doc) : null
}

export async function setCustomerDocumentStatus(
  id: string,
  organizationId: string,
  documentStatus: CustomerDocumentStatus,
): Promise<void> {
  const objectId = toObjectId(id)
  const orgId = toObjectId(organizationId)
  if (!objectId || !orgId) return
  await Customer.updateOne({ _id: objectId, organizationId: orgId }, { $set: { documentStatus } })
}

export type DuplicateSearch = {
  organizationId: string
  excludeId: string
  normalizedEmail?: string
  normalizedPhone?: string
  registrationNumber?: string
}

const MAX_DUPLICATE_CANDIDATES = 20

/** Other customers of the same organization that share an email, phone or registration number. */
export async function findDuplicateCandidates(input: DuplicateSearch): Promise<CustomerRecord[]> {
  const organizationId = toObjectId(input.organizationId)
  const excludeId = toObjectId(input.excludeId)
  if (!organizationId || !excludeId) return []

  const clauses: FilterQuery<ICustomer>[] = []
  if (input.normalizedEmail) clauses.push({ normalizedEmail: input.normalizedEmail })
  if (input.normalizedPhone) clauses.push({ normalizedPhone: input.normalizedPhone })
  if (input.registrationNumber) {
    clauses.push({ 'corporate.registrationNumber': input.registrationNumber })
  }
  if (clauses.length === 0) return []

  const docs = await Customer.find({
    organizationId,
    _id: { $ne: excludeId },
    $or: clauses,
  })
    .limit(MAX_DUPLICATE_CANDIDATES)
    .lean()
  return docs.map(toRecord)
}
