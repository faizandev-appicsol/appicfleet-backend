import type { FilterQuery } from 'mongoose'
import {
  EMPLOYMENT_STATUSES,
  HR_DOCUMENT_STATUSES,
  HR_ENTITY_STATUSES,
  type EmploymentStatus,
  type EmploymentType,
  type HrDocumentStatus,
  type HrDocumentType,
  type HrEntityStatus,
  type HrHistoryKind,
} from '../../constants/hr.js'
import {
  Employee,
  HrCounter,
  HrDepartment,
  HrEmployeeDocument,
  HrEmployeeHistory,
  HrNotificationIntent,
  HrPosition,
} from '../../models/hr.model.js'
import { toObjectId } from '../object-id.js'

type LeanDoc = Record<string, unknown> & { _id: { toString(): string } }

function sid(value: unknown): string {
  return String(value)
}

function oid(value?: string | null) {
  return value ? toObjectId(value) : undefined
}

export type EmployeeAddressRecord = {
  id: string
  type: string
  country?: string
  city?: string
  region?: string
  line1?: string
  line2?: string
  postalCode?: string
  isPrimary: boolean
}

export type EmergencyContactRecord = {
  id: string
  name: string
  relationship?: string
  phone?: string
  email?: string
  isPrimary: boolean
}

export type EmployeeRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  employeeNumber: string
  firstName: string
  middleName?: string
  lastName: string
  preferredName?: string
  dateOfBirth?: Date
  nationality?: string
  personalEmail?: string
  workEmail?: string
  personalPhone?: string
  workPhone?: string
  status: EmploymentStatus
  employmentType: EmploymentType
  jobTitle?: string
  departmentId?: string
  positionId?: string
  managerEmployeeId?: string
  userId?: string
  hireDate?: Date
  probationStartsAt?: Date
  probationEndsAt?: Date
  employmentStartsAt?: Date
  employmentEndsAt?: Date
  profilePhotoStorageKey?: string
  addresses: EmployeeAddressRecord[]
  emergencyContacts: EmergencyContactRecord[]
  notes?: string
  createdBy: string
  updatedBy?: string
  createdAt: Date
  updatedAt: Date
}

export type DepartmentRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId?: string
  name: string
  code: string
  description?: string
  managerEmployeeId?: string
  status: HrEntityStatus
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type PositionRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  departmentId?: string
  name: string
  code: string
  description?: string
  status: HrEntityStatus
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type HrDocumentRecord = {
  id: string
  organizationId: string
  employeeId: string
  documentType: HrDocumentType
  documentNumber?: string
  issuedOn?: Date
  expiresOn?: Date
  issuingAuthority?: string
  storageKey: string
  originalFilename: string
  byteSize: number
  mimeType: string
  sha256: string
  status: HrDocumentStatus
  notes?: string
  uploadedBy: string
  createdAt: Date
  updatedAt: Date
}

export type HrHistoryRecord = {
  id: string
  organizationId: string
  employeeId: string
  kind: HrHistoryKind
  previousValue?: unknown
  newValue?: unknown
  effectiveAt: Date
  reason?: string
  changedBy: string
  createdAt: Date
}

function mapAddresses(raw: unknown): EmployeeAddressRecord[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const row = item as Record<string, unknown>
    return {
      id: sid(row._id ?? row.id),
      type: String(row.type),
      country: row.country ? String(row.country) : undefined,
      city: row.city ? String(row.city) : undefined,
      region: row.region ? String(row.region) : undefined,
      line1: row.line1 ? String(row.line1) : undefined,
      line2: row.line2 ? String(row.line2) : undefined,
      postalCode: row.postalCode ? String(row.postalCode) : undefined,
      isPrimary: Boolean(row.isPrimary),
    }
  })
}

function mapEmergency(raw: unknown): EmergencyContactRecord[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const row = item as Record<string, unknown>
    return {
      id: sid(row._id ?? row.id),
      name: String(row.name),
      relationship: row.relationship ? String(row.relationship) : undefined,
      phone: row.phone ? String(row.phone) : undefined,
      email: row.email ? String(row.email) : undefined,
      isPrimary: Boolean(row.isPrimary),
    }
  })
}

function toEmployee(doc: LeanDoc): EmployeeRecord {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeNumber: String(doc.employeeNumber),
    firstName: String(doc.firstName),
    middleName: doc.middleName ? String(doc.middleName) : undefined,
    lastName: String(doc.lastName),
    preferredName: doc.preferredName ? String(doc.preferredName) : undefined,
    dateOfBirth: doc.dateOfBirth as Date | undefined,
    nationality: doc.nationality ? String(doc.nationality) : undefined,
    personalEmail: doc.personalEmail ? String(doc.personalEmail) : undefined,
    workEmail: doc.workEmail ? String(doc.workEmail) : undefined,
    personalPhone: doc.personalPhone ? String(doc.personalPhone) : undefined,
    workPhone: doc.workPhone ? String(doc.workPhone) : undefined,
    status: doc.status as EmploymentStatus,
    employmentType: doc.employmentType as EmploymentType,
    jobTitle: doc.jobTitle ? String(doc.jobTitle) : undefined,
    departmentId: doc.departmentId ? sid(doc.departmentId) : undefined,
    positionId: doc.positionId ? sid(doc.positionId) : undefined,
    managerEmployeeId: doc.managerEmployeeId ? sid(doc.managerEmployeeId) : undefined,
    userId: doc.userId ? sid(doc.userId) : undefined,
    hireDate: doc.hireDate as Date | undefined,
    probationStartsAt: doc.probationStartsAt as Date | undefined,
    probationEndsAt: doc.probationEndsAt as Date | undefined,
    employmentStartsAt: doc.employmentStartsAt as Date | undefined,
    employmentEndsAt: doc.employmentEndsAt as Date | undefined,
    profilePhotoStorageKey: doc.profilePhotoStorageKey
      ? String(doc.profilePhotoStorageKey)
      : undefined,
    addresses: mapAddresses(doc.addresses),
    emergencyContacts: mapEmergency(doc.emergencyContacts),
    notes: doc.notes ? String(doc.notes) : undefined,
    createdBy: sid(doc.createdBy),
    updatedBy: doc.updatedBy ? sid(doc.updatedBy) : undefined,
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}

function toDepartment(doc: LeanDoc): DepartmentRecord {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: sid(doc.legalEntityId),
    branchId: doc.branchId ? sid(doc.branchId) : undefined,
    name: String(doc.name),
    code: String(doc.code),
    description: doc.description ? String(doc.description) : undefined,
    managerEmployeeId: doc.managerEmployeeId ? sid(doc.managerEmployeeId) : undefined,
    status: doc.status as HrEntityStatus,
    createdBy: sid(doc.createdBy),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}

function toPosition(doc: LeanDoc): PositionRecord {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: sid(doc.legalEntityId),
    departmentId: doc.departmentId ? sid(doc.departmentId) : undefined,
    name: String(doc.name),
    code: String(doc.code),
    description: doc.description ? String(doc.description) : undefined,
    status: doc.status as HrEntityStatus,
    createdBy: sid(doc.createdBy),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}

function toDocument(doc: LeanDoc): HrDocumentRecord {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    employeeId: sid(doc.employeeId),
    documentType: doc.documentType as HrDocumentType,
    documentNumber: doc.documentNumber ? String(doc.documentNumber) : undefined,
    issuedOn: doc.issuedOn as Date | undefined,
    expiresOn: doc.expiresOn as Date | undefined,
    issuingAuthority: doc.issuingAuthority ? String(doc.issuingAuthority) : undefined,
    storageKey: String(doc.storageKey),
    originalFilename: String(doc.originalFilename),
    byteSize: Number(doc.byteSize),
    mimeType: String(doc.mimeType),
    sha256: String(doc.sha256),
    status: doc.status as HrDocumentStatus,
    notes: doc.notes ? String(doc.notes) : undefined,
    uploadedBy: sid(doc.uploadedBy),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}

function toHistory(doc: LeanDoc): HrHistoryRecord {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    employeeId: sid(doc.employeeId),
    kind: doc.kind as HrHistoryKind,
    previousValue: doc.previousValue,
    newValue: doc.newValue,
    effectiveAt: doc.effectiveAt as Date,
    reason: doc.reason ? String(doc.reason) : undefined,
    changedBy: sid(doc.changedBy),
    createdAt: doc.createdAt as Date,
  }
}

export async function allocateEmployeeNumber(organizationId: string): Promise<string> {
  const orgId = toObjectId(organizationId)
  if (!orgId) throw new Error('organizationId is required')
  const counter = await HrCounter.findOneAndUpdate(
    { organizationId: orgId, name: 'employee' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean()
  return `EMP-${String(counter?.seq ?? 1).padStart(6, '0')}`
}

export async function findEmployeeById(id: string): Promise<EmployeeRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Employee.findById(objectId).lean()
  return doc ? toEmployee(doc as LeanDoc) : null
}

export async function findEmployeeByUserId(
  organizationId: string,
  userId: string,
): Promise<EmployeeRecord | null> {
  const orgId = toObjectId(organizationId)
  const uid = toObjectId(userId)
  if (!orgId || !uid) return null
  const doc = await Employee.findOne({ organizationId: orgId, userId: uid }).lean()
  return doc ? toEmployee(doc as LeanDoc) : null
}

export async function listEmployees(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityId?: string
  departmentId?: string
  positionId?: string
  status?: EmploymentStatus
  employmentType?: EmploymentType
  managerEmployeeId?: string
  search?: string
  hireFrom?: Date
  hireTo?: Date
  skip: number
  take: number
  sort?: string
  order?: 'asc' | 'desc'
}): Promise<{ items: EmployeeRecord[]; total: number }> {
  const orgId = toObjectId(input.organizationId)
  if (!orgId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId: orgId }
  if (input.branchIds && input.branchIds.length > 0) {
    filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.legalEntityId) filter.legalEntityId = toObjectId(input.legalEntityId)
  if (input.departmentId) filter.departmentId = toObjectId(input.departmentId)
  if (input.positionId) filter.positionId = toObjectId(input.positionId)
  if (input.status) filter.status = input.status
  if (input.employmentType) filter.employmentType = input.employmentType
  if (input.managerEmployeeId) filter.managerEmployeeId = toObjectId(input.managerEmployeeId)
  if (input.hireFrom || input.hireTo) {
    filter.hireDate = {}
    if (input.hireFrom) (filter.hireDate as Record<string, Date>).$gte = input.hireFrom
    if (input.hireTo) (filter.hireDate as Record<string, Date>).$lte = input.hireTo
  }
  if (input.search?.trim()) {
    const q = input.search.trim()
    filter.$or = [
      { employeeNumber: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { firstName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { lastName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { workEmail: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    ]
  }

  const sortField = input.sort ?? 'createdAt'
  const sortDir = input.order === 'asc' ? 1 : -1
  const [items, total] = await Promise.all([
    Employee.find(filter)
      .sort({ [sortField]: sortDir, _id: -1 })
      .skip(input.skip)
      .limit(input.take)
      .lean(),
    Employee.countDocuments(filter),
  ])
  return { items: items.map((doc) => toEmployee(doc as LeanDoc)), total }
}

export async function insertEmployee(
  input: Omit<EmployeeRecord, 'id' | 'createdAt' | 'updatedAt' | 'employeeNumber' | 'addresses' | 'emergencyContacts'> & {
    employeeNumber?: string
    addresses?: Omit<EmployeeAddressRecord, 'id'>[]
    emergencyContacts?: Omit<EmergencyContactRecord, 'id'>[]
  },
): Promise<EmployeeRecord> {
  const employeeNumber = input.employeeNumber ?? (await allocateEmployeeNumber(input.organizationId))
  const doc = await Employee.create({
    ...input,
    employeeNumber,
    organizationId: toObjectId(input.organizationId),
    legalEntityId: toObjectId(input.legalEntityId),
    branchId: toObjectId(input.branchId),
    departmentId: oid(input.departmentId),
    positionId: oid(input.positionId),
    managerEmployeeId: oid(input.managerEmployeeId),
    userId: oid(input.userId),
    createdBy: toObjectId(input.createdBy),
    addresses: input.addresses ?? [],
    emergencyContacts: input.emergencyContacts ?? [],
  })
  return toEmployee(doc.toObject() as LeanDoc)
}

export async function updateEmployee(
  id: string,
  patch: Partial<{
    firstName: string
    middleName: string | null
    lastName: string
    preferredName: string | null
    dateOfBirth: Date | null
    nationality: string | null
    personalEmail: string | null
    workEmail: string | null
    personalPhone: string | null
    workPhone: string | null
    status: EmploymentStatus
    employmentType: EmploymentType
    jobTitle: string | null
    departmentId: string | null
    positionId: string | null
    managerEmployeeId: string | null
    userId: string | null
    hireDate: Date | null
    probationStartsAt: Date | null
    probationEndsAt: Date | null
    employmentStartsAt: Date | null
    employmentEndsAt: Date | null
    legalEntityId: string
    branchId: string
    addresses: Omit<EmployeeAddressRecord, 'id'>[]
    emergencyContacts: Omit<EmergencyContactRecord, 'id'>[]
    notes: string | null
    updatedBy: string
  }>,
): Promise<EmployeeRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const $set: Record<string, unknown> = {}
  const $unset: Record<string, 1> = {}
  const assign = (key: string, value: unknown) => {
    if (value === null) $unset[key] = 1
    else if (value !== undefined) $set[key] = value
  }
  assign('firstName', patch.firstName)
  assign('middleName', patch.middleName)
  assign('lastName', patch.lastName)
  assign('preferredName', patch.preferredName)
  assign('dateOfBirth', patch.dateOfBirth)
  assign('nationality', patch.nationality)
  assign('personalEmail', patch.personalEmail)
  assign('workEmail', patch.workEmail)
  assign('personalPhone', patch.personalPhone)
  assign('workPhone', patch.workPhone)
  if (patch.status) $set.status = patch.status
  if (patch.employmentType) $set.employmentType = patch.employmentType
  assign('jobTitle', patch.jobTitle)
  if (patch.departmentId !== undefined) {
    if (patch.departmentId === null) $unset.departmentId = 1
    else $set.departmentId = toObjectId(patch.departmentId)
  }
  if (patch.positionId !== undefined) {
    if (patch.positionId === null) $unset.positionId = 1
    else $set.positionId = toObjectId(patch.positionId)
  }
  if (patch.managerEmployeeId !== undefined) {
    if (patch.managerEmployeeId === null) $unset.managerEmployeeId = 1
    else $set.managerEmployeeId = toObjectId(patch.managerEmployeeId)
  }
  if (patch.userId !== undefined) {
    if (patch.userId === null) $unset.userId = 1
    else $set.userId = toObjectId(patch.userId)
  }
  assign('hireDate', patch.hireDate)
  assign('probationStartsAt', patch.probationStartsAt)
  assign('probationEndsAt', patch.probationEndsAt)
  assign('employmentStartsAt', patch.employmentStartsAt)
  assign('employmentEndsAt', patch.employmentEndsAt)
  if (patch.legalEntityId) $set.legalEntityId = toObjectId(patch.legalEntityId)
  if (patch.branchId) $set.branchId = toObjectId(patch.branchId)
  if (patch.addresses) $set.addresses = patch.addresses
  if (patch.emergencyContacts) $set.emergencyContacts = patch.emergencyContacts
  assign('notes', patch.notes)
  if (patch.updatedBy) $set.updatedBy = toObjectId(patch.updatedBy)

  const update: Record<string, unknown> = {}
  if (Object.keys($set).length) update.$set = $set
  if (Object.keys($unset).length) update.$unset = $unset
  if (!Object.keys(update).length) return findEmployeeById(id)

  const doc = await Employee.findByIdAndUpdate(objectId, update, { new: true }).lean()
  return doc ? toEmployee(doc as LeanDoc) : null
}

export async function countEmployeesByStatus(organizationId: string, branchIds?: string[]) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return {} as Record<string, number>
  const match: FilterQuery<unknown> = { organizationId: orgId }
  if (branchIds?.length) {
    match.branchId = { $in: branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  const rows = await Employee.aggregate<{ _id: string; count: number }>([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  return Object.fromEntries(rows.map((row) => [row._id, row.count]))
}

export async function countEmployeesGrouped(
  organizationId: string,
  field: 'departmentId' | 'branchId' | 'employmentType',
  branchIds?: string[],
) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return [] as Array<{ key: string; count: number }>
  const match: FilterQuery<unknown> = { organizationId: orgId, status: EMPLOYMENT_STATUSES.ACTIVE }
  if (branchIds?.length) {
    match.branchId = { $in: branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  const rows = await Employee.aggregate<{ _id: unknown; count: number }>([
    { $match: match },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  ])
  return rows.map((row) => ({
    key: row._id == null ? 'unassigned' : sid(row._id),
    count: row.count,
  }))
}

export async function findDepartmentById(id: string): Promise<DepartmentRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await HrDepartment.findById(objectId).lean()
  return doc ? toDepartment(doc as LeanDoc) : null
}

export async function listDepartments(input: {
  organizationId: string
  legalEntityId?: string
  status?: HrEntityStatus
  search?: string
  skip: number
  take: number
}): Promise<{ items: DepartmentRecord[]; total: number }> {
  const orgId = toObjectId(input.organizationId)
  if (!orgId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId: orgId }
  if (input.legalEntityId) filter.legalEntityId = toObjectId(input.legalEntityId)
  if (input.status) filter.status = input.status
  if (input.search?.trim()) {
    const q = input.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [{ name: new RegExp(q, 'i') }, { code: new RegExp(q, 'i') }]
  }
  const [items, total] = await Promise.all([
    HrDepartment.find(filter).sort({ name: 1 }).skip(input.skip).limit(input.take).lean(),
    HrDepartment.countDocuments(filter),
  ])
  return { items: items.map((doc) => toDepartment(doc as LeanDoc)), total }
}

export async function insertDepartment(
  input: Omit<DepartmentRecord, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<DepartmentRecord> {
  const doc = await HrDepartment.create({
    ...input,
    organizationId: toObjectId(input.organizationId),
    legalEntityId: toObjectId(input.legalEntityId),
    branchId: oid(input.branchId),
    managerEmployeeId: oid(input.managerEmployeeId),
    createdBy: toObjectId(input.createdBy),
    code: input.code.toUpperCase(),
  })
  return toDepartment(doc.toObject() as LeanDoc)
}

export async function updateDepartment(
  id: string,
  patch: Partial<{
    name: string
    description: string | null
    branchId: string | null
    managerEmployeeId: string | null
    status: HrEntityStatus
  }>,
): Promise<DepartmentRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const $set: Record<string, unknown> = {}
  const $unset: Record<string, 1> = {}
  if (patch.name) $set.name = patch.name
  if (patch.description === null) $unset.description = 1
  else if (patch.description !== undefined) $set.description = patch.description
  if (patch.branchId === null) $unset.branchId = 1
  else if (patch.branchId) $set.branchId = toObjectId(patch.branchId)
  if (patch.managerEmployeeId === null) $unset.managerEmployeeId = 1
  else if (patch.managerEmployeeId) $set.managerEmployeeId = toObjectId(patch.managerEmployeeId)
  if (patch.status) $set.status = patch.status
  const update: Record<string, unknown> = {}
  if (Object.keys($set).length) update.$set = $set
  if (Object.keys($unset).length) update.$unset = $unset
  const doc = await HrDepartment.findByIdAndUpdate(objectId, update, { new: true }).lean()
  return doc ? toDepartment(doc as LeanDoc) : null
}

export async function countEmployeesInDepartment(departmentId: string): Promise<number> {
  const id = toObjectId(departmentId)
  if (!id) return 0
  return Employee.countDocuments({ departmentId: id })
}

export async function findPositionById(id: string): Promise<PositionRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await HrPosition.findById(objectId).lean()
  return doc ? toPosition(doc as LeanDoc) : null
}

export async function listPositions(input: {
  organizationId: string
  legalEntityId?: string
  departmentId?: string
  status?: HrEntityStatus
  search?: string
  skip: number
  take: number
}): Promise<{ items: PositionRecord[]; total: number }> {
  const orgId = toObjectId(input.organizationId)
  if (!orgId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId: orgId }
  if (input.legalEntityId) filter.legalEntityId = toObjectId(input.legalEntityId)
  if (input.departmentId) filter.departmentId = toObjectId(input.departmentId)
  if (input.status) filter.status = input.status
  if (input.search?.trim()) {
    const q = input.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [{ name: new RegExp(q, 'i') }, { code: new RegExp(q, 'i') }]
  }
  const [items, total] = await Promise.all([
    HrPosition.find(filter).sort({ name: 1 }).skip(input.skip).limit(input.take).lean(),
    HrPosition.countDocuments(filter),
  ])
  return { items: items.map((doc) => toPosition(doc as LeanDoc)), total }
}

export async function insertPosition(
  input: Omit<PositionRecord, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<PositionRecord> {
  const doc = await HrPosition.create({
    ...input,
    organizationId: toObjectId(input.organizationId),
    legalEntityId: toObjectId(input.legalEntityId),
    departmentId: oid(input.departmentId),
    createdBy: toObjectId(input.createdBy),
    code: input.code.toUpperCase(),
  })
  return toPosition(doc.toObject() as LeanDoc)
}

export async function updatePosition(
  id: string,
  patch: Partial<{
    name: string
    description: string | null
    departmentId: string | null
    status: HrEntityStatus
  }>,
): Promise<PositionRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const $set: Record<string, unknown> = {}
  const $unset: Record<string, 1> = {}
  if (patch.name) $set.name = patch.name
  if (patch.description === null) $unset.description = 1
  else if (patch.description !== undefined) $set.description = patch.description
  if (patch.departmentId === null) $unset.departmentId = 1
  else if (patch.departmentId) $set.departmentId = toObjectId(patch.departmentId)
  if (patch.status) $set.status = patch.status
  const update: Record<string, unknown> = {}
  if (Object.keys($set).length) update.$set = $set
  if (Object.keys($unset).length) update.$unset = $unset
  const doc = await HrPosition.findByIdAndUpdate(objectId, update, { new: true }).lean()
  return doc ? toPosition(doc as LeanDoc) : null
}

export async function countEmployeesInPosition(positionId: string): Promise<number> {
  const id = toObjectId(positionId)
  if (!id) return 0
  return Employee.countDocuments({ positionId: id })
}

export async function insertHistory(
  input: Omit<HrHistoryRecord, 'id' | 'createdAt'>,
): Promise<HrHistoryRecord> {
  const doc = await HrEmployeeHistory.create({
    ...input,
    organizationId: toObjectId(input.organizationId),
    employeeId: toObjectId(input.employeeId),
    changedBy: toObjectId(input.changedBy),
  })
  return toHistory(doc.toObject() as LeanDoc)
}

export async function listHistory(input: {
  organizationId: string
  employeeId: string
  skip: number
  take: number
}): Promise<{ items: HrHistoryRecord[]; total: number }> {
  const orgId = toObjectId(input.organizationId)
  const employeeId = toObjectId(input.employeeId)
  if (!orgId || !employeeId) return { items: [], total: 0 }
  const filter = { organizationId: orgId, employeeId }
  const [items, total] = await Promise.all([
    HrEmployeeHistory.find(filter).sort({ createdAt: -1 }).skip(input.skip).limit(input.take).lean(),
    HrEmployeeHistory.countDocuments(filter),
  ])
  return { items: items.map((doc) => toHistory(doc as LeanDoc)), total }
}

export async function insertDocument(
  input: Omit<HrDocumentRecord, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<HrDocumentRecord> {
  const doc = await HrEmployeeDocument.create({
    ...input,
    organizationId: toObjectId(input.organizationId),
    employeeId: toObjectId(input.employeeId),
    uploadedBy: toObjectId(input.uploadedBy),
  })
  return toDocument(doc.toObject() as LeanDoc)
}

export async function findDocumentById(id: string): Promise<HrDocumentRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await HrEmployeeDocument.findById(objectId).lean()
  return doc ? toDocument(doc as LeanDoc) : null
}

export async function listDocuments(input: {
  organizationId: string
  employeeId: string
  status?: HrDocumentStatus
  skip: number
  take: number
}): Promise<{ items: HrDocumentRecord[]; total: number }> {
  const orgId = toObjectId(input.organizationId)
  const employeeId = toObjectId(input.employeeId)
  if (!orgId || !employeeId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId: orgId, employeeId }
  if (input.status) filter.status = input.status
  const [items, total] = await Promise.all([
    HrEmployeeDocument.find(filter).sort({ createdAt: -1 }).skip(input.skip).limit(input.take).lean(),
    HrEmployeeDocument.countDocuments(filter),
  ])
  return { items: items.map((doc) => toDocument(doc as LeanDoc)), total }
}

export async function updateDocument(
  id: string,
  patch: Partial<{
    documentNumber: string | null
    issuedOn: Date | null
    expiresOn: Date | null
    issuingAuthority: string | null
    status: HrDocumentStatus
    notes: string | null
    storageKey: string
    originalFilename: string
    byteSize: number
    mimeType: string
    sha256: string
  }>,
): Promise<HrDocumentRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const $set: Record<string, unknown> = {}
  const $unset: Record<string, 1> = {}
  const assign = (key: string, value: unknown) => {
    if (value === null) $unset[key] = 1
    else if (value !== undefined) $set[key] = value
  }
  assign('documentNumber', patch.documentNumber)
  assign('issuedOn', patch.issuedOn)
  assign('expiresOn', patch.expiresOn)
  assign('issuingAuthority', patch.issuingAuthority)
  assign('notes', patch.notes)
  if (patch.status) $set.status = patch.status
  if (patch.storageKey) $set.storageKey = patch.storageKey
  if (patch.originalFilename) $set.originalFilename = patch.originalFilename
  if (patch.byteSize) $set.byteSize = patch.byteSize
  if (patch.mimeType) $set.mimeType = patch.mimeType
  if (patch.sha256) $set.sha256 = patch.sha256
  const update: Record<string, unknown> = {}
  if (Object.keys($set).length) update.$set = $set
  if (Object.keys($unset).length) update.$unset = $unset
  const doc = await HrEmployeeDocument.findByIdAndUpdate(objectId, update, { new: true }).lean()
  return doc ? toDocument(doc as LeanDoc) : null
}

export async function listExpiringDocuments(input: {
  organizationId: string
  before: Date
  statusIn?: HrDocumentStatus[]
  skip: number
  take: number
}): Promise<{ items: HrDocumentRecord[]; total: number }> {
  const orgId = toObjectId(input.organizationId)
  if (!orgId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = {
    organizationId: orgId,
    expiresOn: { $ne: null, $lte: input.before },
    status: { $ne: HR_DOCUMENT_STATUSES.ARCHIVED },
  }
  if (input.statusIn?.length) filter.status = { $in: input.statusIn }
  const [items, total] = await Promise.all([
    HrEmployeeDocument.find(filter).sort({ expiresOn: 1 }).skip(input.skip).limit(input.take).lean(),
    HrEmployeeDocument.countDocuments(filter),
  ])
  return { items: items.map((doc) => toDocument(doc as LeanDoc)), total }
}

export async function countDocumentStatuses(organizationId: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return {} as Record<string, number>
  const rows = await HrEmployeeDocument.aggregate<{ _id: string; count: number }>([
    { $match: { organizationId: orgId, status: { $ne: HR_DOCUMENT_STATUSES.ARCHIVED } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  return Object.fromEntries(rows.map((row) => [row._id, row.count]))
}

/** Returns true when the intent was newly inserted (idempotent). */
export async function tryInsertNotificationIntent(input: {
  organizationId: string
  employeeId: string
  documentId?: string
  intentKey: string
  kind: string
  payload?: Record<string, unknown>
}): Promise<boolean> {
  try {
    await HrNotificationIntent.create({
      organizationId: toObjectId(input.organizationId),
      employeeId: toObjectId(input.employeeId),
      documentId: oid(input.documentId),
      intentKey: input.intentKey,
      kind: input.kind,
      payload: input.payload,
    })
    return true
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false
    throw error
  }
}

export async function listDirectReports(
  organizationId: string,
  managerEmployeeId: string,
): Promise<EmployeeRecord[]> {
  const orgId = toObjectId(organizationId)
  const managerId = toObjectId(managerEmployeeId)
  if (!orgId || !managerId) return []
  const docs = await Employee.find({ organizationId: orgId, managerEmployeeId: managerId })
    .sort({ lastName: 1, firstName: 1 })
    .lean()
  return docs.map((doc) => toEmployee(doc as LeanDoc))
}

export { HR_ENTITY_STATUSES }
