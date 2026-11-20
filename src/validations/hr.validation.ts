import { z } from 'zod'
import {
  EMPLOYEE_SORT_FIELDS,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  HR_ADDRESS_TYPES,
  HR_DOCUMENT_TYPES,
  HR_ENTITY_STATUSES,
} from '../constants/hr.js'
import { objectIdSchema, paginationQuerySchema } from './common.validation.js'
import { clearableText, enumInput, instantSchema, optionalText } from './vehicle.validation.js'

const employmentStatusInput = enumInput(Object.values(EMPLOYMENT_STATUSES))
const employmentTypeInput = enumInput(Object.values(EMPLOYMENT_TYPES))
const entityStatusInput = enumInput(Object.values(HR_ENTITY_STATUSES))
const documentTypeInput = enumInput(Object.values(HR_DOCUMENT_TYPES))
const addressTypeInput = enumInput(Object.values(HR_ADDRESS_TYPES))

const addressSchema = z.object({
  type: addressTypeInput,
  country: z.string().trim().length(2).optional(),
  city: optionalText(100),
  region: optionalText(100),
  line1: optionalText(200),
  line2: optionalText(200),
  postalCode: optionalText(32),
  isPrimary: z.boolean().optional(),
})

const emergencyContactSchema = z.object({
  name: z.string().trim().min(2).max(200),
  relationship: optionalText(100),
  phone: optionalText(40),
  email: z.email().optional().or(z.literal('')),
  isPrimary: z.boolean().optional(),
})

export const listEmployeesQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  departmentId: objectIdSchema.optional(),
  positionId: objectIdSchema.optional(),
  status: employmentStatusInput.optional(),
  employmentType: employmentTypeInput.optional(),
  hireFrom: instantSchema.optional(),
  hireTo: instantSchema.optional(),
  sort: z.enum(EMPLOYEE_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createEmployeeBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  branchId: objectIdSchema,
  firstName: z.string().trim().min(1).max(100),
  middleName: optionalText(100),
  lastName: z.string().trim().min(1).max(100),
  preferredName: optionalText(100),
  dateOfBirth: instantSchema.optional(),
  nationality: z.string().trim().length(2).optional(),
  personalEmail: z.email().optional(),
  workEmail: z.email().optional(),
  personalPhone: optionalText(40),
  workPhone: optionalText(40),
  employmentType: employmentTypeInput.optional(),
  jobTitle: optionalText(200),
  departmentId: objectIdSchema.optional(),
  positionId: objectIdSchema.optional(),
  managerEmployeeId: objectIdSchema.optional(),
  hireDate: instantSchema.optional(),
  probationStartsAt: instantSchema.optional(),
  probationEndsAt: instantSchema.optional(),
  employmentStartsAt: instantSchema.optional(),
  notes: optionalText(4000),
})

export const updateEmployeeBodySchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    middleName: clearableText(100),
    lastName: z.string().trim().min(1).max(100).optional(),
    preferredName: clearableText(100),
    dateOfBirth: instantSchema.nullable().optional(),
    nationality: z.string().trim().length(2).nullable().optional(),
    personalEmail: z.email().nullable().optional(),
    workEmail: z.email().nullable().optional(),
    personalPhone: clearableText(40),
    workPhone: clearableText(40),
    employmentType: employmentTypeInput.optional(),
    jobTitle: clearableText(200),
    departmentId: objectIdSchema.nullable().optional(),
    positionId: objectIdSchema.nullable().optional(),
    managerEmployeeId: objectIdSchema.nullable().optional(),
    hireDate: instantSchema.nullable().optional(),
    probationStartsAt: instantSchema.nullable().optional(),
    probationEndsAt: instantSchema.nullable().optional(),
    employmentStartsAt: instantSchema.nullable().optional(),
    employmentEndsAt: instantSchema.nullable().optional(),
    notes: clearableText(4000),
    addresses: z.array(addressSchema).max(10).optional(),
    emergencyContacts: z.array(emergencyContactSchema).max(10).optional(),
    reason: optionalText(1000),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field',
  })

export const changeStatusBodySchema = z.object({
  status: employmentStatusInput,
  effectiveAt: instantSchema.optional(),
  reason: optionalText(1000),
})

export const transferBodySchema = z.object({
  legalEntityId: objectIdSchema,
  branchId: objectIdSchema,
  departmentId: objectIdSchema.nullable().optional(),
  positionId: objectIdSchema.nullable().optional(),
  managerEmployeeId: objectIdSchema.nullable().optional(),
  effectiveAt: instantSchema.optional(),
  reason: optionalText(1000),
})

export const linkUserBodySchema = z.object({
  userId: objectIdSchema,
})

export const createDepartmentBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  branchId: objectIdSchema.optional(),
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().min(2).max(40),
  description: optionalText(2000),
  managerEmployeeId: objectIdSchema.optional(),
})

export const updateDepartmentBodySchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    description: clearableText(2000),
    branchId: objectIdSchema.nullable().optional(),
    managerEmployeeId: objectIdSchema.nullable().optional(),
    status: entityStatusInput.optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field',
  })

export const listDepartmentsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  status: entityStatusInput.optional(),
})

export const createPositionBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  departmentId: objectIdSchema.optional(),
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().min(2).max(40),
  description: optionalText(2000),
})

export const updatePositionBodySchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    description: clearableText(2000),
    departmentId: objectIdSchema.nullable().optional(),
    status: entityStatusInput.optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field',
  })

export const listPositionsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  departmentId: objectIdSchema.optional(),
  status: entityStatusInput.optional(),
})

export const uploadHrDocumentBodySchema = z.object({
  documentType: documentTypeInput,
  documentNumber: optionalText(100),
  issuedOn: instantSchema.optional(),
  expiresOn: instantSchema.optional(),
  issuingAuthority: optionalText(200),
  notes: optionalText(2000),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(120),
  contentBase64: z.string().min(1),
})

export const documentParamsSchema = z.object({
  id: objectIdSchema,
  documentId: objectIdSchema,
})

export const listExpiryQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  days: z.coerce.number().int().positive().max(365).optional(),
})

export const hrSummaryQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
})

export { objectIdSchema }
