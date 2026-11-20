import { Schema, model } from 'mongoose'
import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  HR_ADDRESS_TYPES,
  HR_DOCUMENT_STATUSES,
  HR_DOCUMENT_TYPES,
  HR_ENTITY_STATUSES,
  HR_HISTORY_KINDS,
} from '../constants/hr.js'

const addressSchema = new Schema(
  {
    type: { type: String, enum: Object.values(HR_ADDRESS_TYPES), required: true },
    country: { type: String, trim: true, maxlength: 2 },
    city: { type: String, trim: true, maxlength: 100 },
    region: { type: String, trim: true, maxlength: 100 },
    line1: { type: String, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200 },
    postalCode: { type: String, trim: true, maxlength: 32 },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true },
)

const emergencyContactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    relationship: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 40 },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true },
)

const employeeSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeNumber: { type: String, required: true, trim: true, maxlength: 32 },
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    middleName: { type: String, trim: true, maxlength: 100 },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    preferredName: { type: String, trim: true, maxlength: 100 },
    dateOfBirth: { type: Date },
    nationality: { type: String, trim: true, maxlength: 2 },
    personalEmail: { type: String, trim: true, lowercase: true, maxlength: 200 },
    workEmail: { type: String, trim: true, lowercase: true, maxlength: 200 },
    personalPhone: { type: String, trim: true, maxlength: 40 },
    workPhone: { type: String, trim: true, maxlength: 40 },
    status: {
      type: String,
      required: true,
      enum: Object.values(EMPLOYMENT_STATUSES),
      default: EMPLOYMENT_STATUSES.ACTIVE,
    },
    employmentType: {
      type: String,
      required: true,
      enum: Object.values(EMPLOYMENT_TYPES),
      default: EMPLOYMENT_TYPES.FULL_TIME,
    },
    jobTitle: { type: String, trim: true, maxlength: 200 },
    departmentId: { type: Schema.Types.ObjectId, ref: 'HrDepartment' },
    positionId: { type: Schema.Types.ObjectId, ref: 'HrPosition' },
    managerEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    hireDate: { type: Date },
    probationStartsAt: { type: Date },
    probationEndsAt: { type: Date },
    employmentStartsAt: { type: Date },
    employmentEndsAt: { type: Date },
    profilePhotoStorageKey: { type: String, trim: true, maxlength: 128 },
    addresses: { type: [addressSchema], default: [] },
    emergencyContacts: { type: [emergencyContactSchema], default: [] },
    notes: { type: String, trim: true, maxlength: 4000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'employees' },
)

employeeSchema.index({ organizationId: 1, employeeNumber: 1 }, { unique: true })
employeeSchema.index({ organizationId: 1, status: 1, lastName: 1, firstName: 1 })
employeeSchema.index({ organizationId: 1, branchId: 1, status: 1 })
employeeSchema.index({ organizationId: 1, legalEntityId: 1 })
employeeSchema.index({ organizationId: 1, departmentId: 1 })
employeeSchema.index({ organizationId: 1, positionId: 1 })
employeeSchema.index({ organizationId: 1, managerEmployeeId: 1 })
employeeSchema.index({ organizationId: 1, userId: 1 }, { unique: true, sparse: true })
employeeSchema.index({ organizationId: 1, workEmail: 1 })
employeeSchema.index({ organizationId: 1, hireDate: 1 })
employeeSchema.index({
  organizationId: 1,
  lastName: 'text',
  firstName: 'text',
  employeeNumber: 'text',
  workEmail: 'text',
})

const departmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 2000 },
    managerEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    status: {
      type: String,
      required: true,
      enum: Object.values(HR_ENTITY_STATUSES),
      default: HR_ENTITY_STATUSES.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'hr_departments' },
)

departmentSchema.index({ organizationId: 1, legalEntityId: 1, code: 1 }, { unique: true })
departmentSchema.index({ organizationId: 1, status: 1, name: 1 })

const positionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'HrDepartment' },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      required: true,
      enum: Object.values(HR_ENTITY_STATUSES),
      default: HR_ENTITY_STATUSES.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'hr_positions' },
)

positionSchema.index({ organizationId: 1, legalEntityId: 1, code: 1 }, { unique: true })
positionSchema.index({ organizationId: 1, departmentId: 1, status: 1 })

const documentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    documentType: { type: String, required: true, enum: Object.values(HR_DOCUMENT_TYPES) },
    documentNumber: { type: String, trim: true, maxlength: 100 },
    issuedOn: { type: Date },
    expiresOn: { type: Date },
    issuingAuthority: { type: String, trim: true, maxlength: 200 },
    storageKey: { type: String, required: true, trim: true, maxlength: 128 },
    originalFilename: { type: String, required: true, trim: true, maxlength: 255 },
    byteSize: { type: Number, required: true, min: 1 },
    mimeType: { type: String, required: true, trim: true, maxlength: 120 },
    sha256: { type: String, required: true, trim: true, maxlength: 64 },
    status: {
      type: String,
      required: true,
      enum: Object.values(HR_DOCUMENT_STATUSES),
      default: HR_DOCUMENT_STATUSES.VALID,
    },
    notes: { type: String, trim: true, maxlength: 2000 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'hr_employee_documents' },
)

documentSchema.index({ organizationId: 1, employeeId: 1, createdAt: -1 })
documentSchema.index({ organizationId: 1, expiresOn: 1, status: 1 })
documentSchema.index({ organizationId: 1, sha256: 1 })

const historySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    kind: { type: String, required: true, enum: Object.values(HR_HISTORY_KINDS) },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    effectiveAt: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 1000 },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'hr_employee_history' },
)

historySchema.index({ organizationId: 1, employeeId: 1, createdAt: -1 })
historySchema.index({ organizationId: 1, kind: 1, effectiveAt: -1 })

const notificationIntentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'HrEmployeeDocument' },
    /** Idempotency key, e.g. `doc-expiring:{documentId}:2026-W12`. */
    intentKey: { type: String, required: true, trim: true, maxlength: 200 },
    kind: { type: String, required: true, trim: true, maxlength: 80 },
    payload: { type: Schema.Types.Mixed },
    processedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'hr_notification_intents' },
)

notificationIntentSchema.index({ intentKey: 1 }, { unique: true })
notificationIntentSchema.index({ organizationId: 1, createdAt: -1 })

const counterSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    seq: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true, collection: 'hr_counters' },
)

counterSchema.index({ organizationId: 1, name: 1 }, { unique: true })

export const Employee = model('Employee', employeeSchema)
export const HrDepartment = model('HrDepartment', departmentSchema)
export const HrPosition = model('HrPosition', positionSchema)
export const HrEmployeeDocument = model('HrEmployeeDocument', documentSchema)
export const HrEmployeeHistory = model('HrEmployeeHistory', historySchema)
export const HrNotificationIntent = model('HrNotificationIntent', notificationIntentSchema)
export const HrCounter = model('HrCounter', counterSchema)
