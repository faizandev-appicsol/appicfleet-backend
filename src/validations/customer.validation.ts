import { z } from 'zod'
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  CONTACT_ROLES,
  CONTACT_STATUSES,
  CUSTOMER_DOCUMENT_STATUSES,
  CUSTOMER_DOCUMENT_TYPES,
  CUSTOMER_FILE_STATUSES,
  CUSTOMER_SORT_FIELDS,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  DUPLICATE_REVIEW_STATUSES,
  MAX_UPLOAD_BASE64_LENGTH,
} from '../constants/customers.js'
import {
  AT_LEAST_ONE_FIELD_MESSAGE,
  atLeastOneField,
  idParamsSchema,
  objectIdSchema,
  paginationQuerySchema,
} from './common.validation.js'
import {
  clearableText,
  dateOnlySchema,
  enumInput,
  futureDateOnlySchema,
  optionalText,
  text,
} from './vehicle.validation.js'

const customerTypeInput = enumInput(Object.values(CUSTOMER_TYPES))
const customerStatusInput = enumInput(Object.values(CUSTOMER_STATUSES))
const documentStatusInput = enumInput(Object.values(CUSTOMER_DOCUMENT_STATUSES))
const contactRoleInput = enumInput(Object.values(CONTACT_ROLES))
const contactStatusInput = enumInput(Object.values(CONTACT_STATUSES))
const documentTypeInput = enumInput(Object.values(CUSTOMER_DOCUMENT_TYPES))
const fileStatusInput = enumInput(Object.values(CUSTOMER_FILE_STATUSES))
const duplicateStatusFilterInput = enumInput(Object.values(DUPLICATE_REVIEW_STATUSES))

// ---------------------------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------------------------

const emailValue = z.email('Enter a valid email address').max(200, 'Use at most 200 characters')
const phoneValue = z
  .string()
  .regex(/^\+?[0-9 ()\-.]{6,30}$/, 'Enter a valid phone number')
  .refine((value) => value.replace(/\D/g, '').length >= 6, 'Enter a valid phone number')

/** Create: blank is dropped so the field is omitted. */
const emailCreateSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .pipe(emailValue.optional())
  .optional()

/** Update: null or blank clears the field. */
const emailUpdateSchema = z
  .string()
  .trim()
  .nullable()
  .transform((value) => (value === '' ? null : value))
  .pipe(emailValue.nullable())
  .optional()

const phoneCreateSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .pipe(phoneValue.optional())
  .optional()

const phoneUpdateSchema = z
  .string()
  .trim()
  .nullable()
  .transform((value) => (value === '' ? null : value))
  .pipe(phoneValue.nullable())
  .optional()

const addressSchema = z.object({
  line1: text(200),
  city: text(100),
  country: text(60, 2),
})

// ---------------------------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------------------------

const individualCreateSchema = z.object({
  firstName: text(80),
  middleName: optionalText(80),
  lastName: text(80),
  dateOfBirth: dateOnlySchema.optional(),
  nationality: optionalText(60),
})

const corporateCreateSchema = z.object({
  legalName: text(160),
  tradeName: optionalText(160),
  registrationNumber: optionalText(60),
  taxNumber: optionalText(60),
})

const individualUpdateSchema = z.object({
  firstName: text(80).optional(),
  middleName: clearableText(80),
  lastName: text(80).optional(),
  dateOfBirth: dateOnlySchema.nullable().optional(),
  nationality: clearableText(60),
})

const corporateUpdateSchema = z.object({
  legalName: text(160).optional(),
  tradeName: clearableText(160),
  registrationNumber: clearableText(60),
  taxNumber: clearableText(60),
})

export const createCustomerBodySchema = z
  .object({
    /** Platform-wide accounts must name the organization; everyone else is bound to their own. */
    organizationId: objectIdSchema.optional(),
    branchId: objectIdSchema,
    type: customerTypeInput,
    /** Derived from the name block when omitted. */
    displayName: optionalText(200),
    email: emailCreateSchema,
    phone: phoneCreateSchema,
    alternatePhone: phoneCreateSchema,
    address: addressSchema.optional(),
    notes: optionalText(2000),
    individual: individualCreateSchema.optional(),
    corporate: corporateCreateSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const isIndividual = value.type === CUSTOMER_TYPES.INDIVIDUAL
    if (isIndividual && !value.individual) {
      ctx.addIssue({ code: 'custom', message: 'Enter the individual details', path: ['individual'] })
    }
    if (!isIndividual && !value.corporate) {
      ctx.addIssue({ code: 'custom', message: 'Enter the corporate details', path: ['corporate'] })
    }
    if (isIndividual && value.corporate) {
      ctx.addIssue({
        code: 'custom',
        message: 'Corporate details do not apply to an individual',
        path: ['corporate'],
      })
    }
    if (!isIndividual && value.individual) {
      ctx.addIssue({
        code: 'custom',
        message: 'Individual details do not apply to a corporate customer',
        path: ['individual'],
      })
    }
  })

/**
 * The customer type and branch are fixed after creation (documents carry the branch).
 * Name blocks that do not match the stored type are rejected in the service.
 */
export const updateCustomerBodySchema = z
  .object({
    displayName: text(200).optional(),
    email: emailUpdateSchema,
    phone: phoneUpdateSchema,
    alternatePhone: phoneUpdateSchema,
    address: addressSchema.nullable().optional(),
    notes: clearableText(2000),
    individual: individualUpdateSchema.optional(),
    corporate: corporateUpdateSchema.optional(),
  })
  .refine(atLeastOneField, AT_LEAST_ONE_FIELD_MESSAGE)

export const customerIdParamsSchema = idParamsSchema

/** `reveal=true` asks for unmasked sensitive values; it only works with customer.view_sensitive. */
const revealSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional()

export const customerRevealQuerySchema = z.object({ reveal: revealSchema })

export const listCustomersQuerySchema = paginationQuerySchema.extend({
  /** Only used by platform-wide accounts; ignored for organization-bound accounts. */
  organizationId: objectIdSchema.optional(),
  type: customerTypeInput.optional(),
  status: customerStatusInput.optional(),
  branchId: objectIdSchema.optional(),
  documentStatus: documentStatusInput.optional(),
  sort: z.enum(CUSTOMER_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const changeCustomerStatusBodySchema = z.object({
  status: customerStatusInput,
  reason: optionalText(500),
})

// ---------------------------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------------------------

export const customerContactParamsSchema = z.object({
  id: objectIdSchema,
  contactId: objectIdSchema,
})

export const listCustomerContactsQuerySchema = paginationQuerySchema
  .omit({ search: true })
  .extend({
    status: contactStatusInput.optional(),
    reveal: revealSchema,
  })

export const createCustomerContactBodySchema = z.object({
  name: text(120),
  phone: phoneCreateSchema,
  email: emailCreateSchema,
  role: contactRoleInput.optional(),
  licenseNumber: optionalText(60),
  licenseExpiresOn: futureDateOnlySchema.optional(),
  isPrimary: z.boolean().optional(),
})

export const updateCustomerContactBodySchema = z
  .object({
    name: text(120).optional(),
    phone: phoneUpdateSchema,
    email: emailUpdateSchema,
    role: contactRoleInput.optional(),
    licenseNumber: clearableText(60),
    licenseExpiresOn: futureDateOnlySchema.nullable().optional(),
    isPrimary: z.boolean().optional(),
  })
  .refine(atLeastOneField, AT_LEAST_ONE_FIELD_MESSAGE)

// ---------------------------------------------------------------------------------------------
// Documents and OCR
// ---------------------------------------------------------------------------------------------

export const customerDocumentParamsSchema = z.object({
  id: objectIdSchema,
  documentId: objectIdSchema,
})

/** `view` is an inline preview; anything else is a download. Both are audited separately. */
export const documentContentQuerySchema = z.object({
  intent: z.enum(['view', 'download']).optional(),
})

export const listCustomerDocumentsQuerySchema = paginationQuerySchema.omit({ search: true }).extend({
  status: fileStatusInput.optional(),
  documentType: documentTypeInput.optional(),
})

const mimeTypeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z.enum(ALLOWED_UPLOAD_MIME_TYPES, {
      error: 'Use a JPEG, PNG, WebP or PDF file',
    }),
  )

/**
 * Upload body (JSON, no multipart). The base64 length is capped here so an oversized payload is
 * rejected before it is decoded; the exact decoded size and magic bytes are checked in the service.
 */
export const uploadCustomerDocumentBodySchema = z
  .object({
    documentType: documentTypeInput,
    filename: z.string().trim().min(1, 'Enter a filename').max(255, 'Use at most 255 characters'),
    mimeType: mimeTypeSchema,
    contentBase64: z
      .string()
      .min(1, 'Provide the file content')
      .max(MAX_UPLOAD_BASE64_LENGTH, 'The file is too large (5 MB maximum)'),
    issuedOn: dateOnlySchema.optional(),
    expiresOn: futureDateOnlySchema.optional(),
  })
  .refine(
    (value) =>
      !value.issuedOn || !value.expiresOn || value.expiresOn.getTime() >= value.issuedOn.getTime(),
    { message: 'expiresOn must not be before issuedOn', path: ['expiresOn'] },
  )

export const listOcrRunsQuerySchema = paginationQuerySchema.omit({ search: true }).extend({
  reveal: revealSchema,
})

export const customerOcrRunParamsSchema = z.object({
  id: objectIdSchema,
  documentId: objectIdSchema,
  runId: objectIdSchema,
})

export const reviewOcrBodySchema = z.object({
  decision: z.enum(['approve', 'reject']),
  /** Corrections for fields the run extracted. Ignored when rejecting. */
  fields: z
    .array(z.object({ key: text(60), value: text(500) }))
    .max(50, 'Use at most 50 fields')
    .optional(),
})

// ---------------------------------------------------------------------------------------------
// Duplicates
// ---------------------------------------------------------------------------------------------

export const customerDuplicateParamsSchema = z.object({
  id: objectIdSchema,
  reviewId: objectIdSchema,
})

export const listCustomerDuplicatesQuerySchema = paginationQuerySchema
  .omit({ search: true })
  .extend({ status: duplicateStatusFilterInput.optional() })

export const reviewDuplicateBodySchema = z.object({
  status: z
    .enum(['confirmed', 'not_duplicate', 'under_review'])
    .transform((value) => value.toUpperCase() as 'CONFIRMED' | 'NOT_DUPLICATE' | 'UNDER_REVIEW'),
  note: optionalText(500),
})

export type CreateCustomerBody = z.infer<typeof createCustomerBodySchema>
export type UpdateCustomerBody = z.infer<typeof updateCustomerBodySchema>
export type CustomerIdParams = z.infer<typeof customerIdParamsSchema>
export type CustomerRevealQuery = z.infer<typeof customerRevealQuerySchema>
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>
export type ChangeCustomerStatusBody = z.infer<typeof changeCustomerStatusBodySchema>
export type CustomerContactParams = z.infer<typeof customerContactParamsSchema>
export type ListCustomerContactsQuery = z.infer<typeof listCustomerContactsQuerySchema>
export type CreateCustomerContactBody = z.infer<typeof createCustomerContactBodySchema>
export type UpdateCustomerContactBody = z.infer<typeof updateCustomerContactBodySchema>
export type CustomerDocumentParams = z.infer<typeof customerDocumentParamsSchema>
export type DocumentContentQuery = z.infer<typeof documentContentQuerySchema>
export type ListCustomerDocumentsQuery = z.infer<typeof listCustomerDocumentsQuerySchema>
export type UploadCustomerDocumentBody = z.infer<typeof uploadCustomerDocumentBodySchema>
export type ListOcrRunsQuery = z.infer<typeof listOcrRunsQuerySchema>
export type CustomerOcrRunParams = z.infer<typeof customerOcrRunParamsSchema>
export type ReviewOcrBody = z.infer<typeof reviewOcrBodySchema>
export type CustomerDuplicateParams = z.infer<typeof customerDuplicateParamsSchema>
export type ListCustomerDuplicatesQuery = z.infer<typeof listCustomerDuplicatesQuerySchema>
export type ReviewDuplicateBody = z.infer<typeof reviewDuplicateBodySchema>
