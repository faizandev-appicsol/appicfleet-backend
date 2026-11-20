import { toPublicEnum } from '../../constants/vehicles.js'
import type { CustomerContactRecord } from '../../repositories/customers/customer-contact.repository.js'
import type { CustomerDocumentRecord } from '../../repositories/customers/customer-document.repository.js'
import type { DuplicateReviewRecord } from '../../repositories/customers/customer-duplicate-review.repository.js'
import type { CustomerOcrRunRecord } from '../../repositories/customers/customer-ocr-run.repository.js'
import type { CustomerRecord } from '../../repositories/customers/customer.repository.js'
import { toDateOnly } from '../vehicles/vehicle.mapper.js'
import { maskByKey, maskValue } from './mask.js'

function optionalDateOnly(date: Date | undefined): string | undefined {
  return date ? toDateOnly(date) : undefined
}

export type CustomerListResource = {
  id: string
  customerNumber: string
  type: string
  status: string
  displayName: string
  email?: string
  phone?: string
  branchId: string
  legalEntityId: string
  documentStatus: string
  createdAt: string
}

export type CustomerResource = CustomerListResource & {
  organizationId: string
  alternatePhone?: string
  address?: { line1: string; city: string; country: string }
  notes?: string
  individual?: {
    firstName: string
    middleName?: string
    lastName: string
    dateOfBirth?: string
    nationality?: string
  }
  corporate?: {
    legalName: string
    tradeName?: string
    /** Masked unless the caller has customer.view_sensitive and sent reveal=true. */
    registrationNumber?: string
    taxNumber?: string
  }
  createdBy: string
  updatedAt: string
}

export function toCustomerListResource(customer: CustomerRecord): CustomerListResource {
  return {
    id: customer.id,
    customerNumber: customer.customerNumber,
    type: toPublicEnum(customer.type),
    status: toPublicEnum(customer.status),
    displayName: customer.displayName,
    email: customer.email,
    phone: customer.phone,
    branchId: customer.branchId,
    legalEntityId: customer.legalEntityId,
    documentStatus: toPublicEnum(customer.documentStatus),
    createdAt: customer.createdAt.toISOString(),
  }
}

export function toCustomerResource(customer: CustomerRecord, reveal: boolean): CustomerResource {
  return {
    ...toCustomerListResource(customer),
    organizationId: customer.organizationId,
    alternatePhone: customer.alternatePhone,
    address: customer.address ? { ...customer.address } : undefined,
    notes: customer.notes,
    individual: customer.individual
      ? {
          firstName: customer.individual.firstName,
          middleName: customer.individual.middleName,
          lastName: customer.individual.lastName,
          dateOfBirth: optionalDateOnly(customer.individual.dateOfBirth),
          nationality: customer.individual.nationality,
        }
      : undefined,
    corporate: customer.corporate
      ? {
          legalName: customer.corporate.legalName,
          tradeName: customer.corporate.tradeName,
          registrationNumber: maskValue(customer.corporate.registrationNumber, reveal),
          taxNumber: maskValue(customer.corporate.taxNumber, reveal),
        }
      : undefined,
    createdBy: customer.createdBy,
    updatedAt: customer.updatedAt.toISOString(),
  }
}

export type CustomerContactResource = {
  id: string
  customerId: string
  name: string
  phone?: string
  email?: string
  role: string
  /** Masked unless the caller has customer.view_sensitive and sent reveal=true. */
  licenseNumber?: string
  licenseExpiresOn?: string
  isPrimary: boolean
  status: string
  createdAt: string
  updatedAt: string
}

export function toContactResource(
  contact: CustomerContactRecord,
  reveal: boolean,
): CustomerContactResource {
  return {
    id: contact.id,
    customerId: contact.customerId,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    role: toPublicEnum(contact.role),
    licenseNumber: maskValue(contact.licenseNumber, reveal),
    licenseExpiresOn: optionalDateOnly(contact.licenseExpiresOn),
    isPrimary: contact.isPrimary,
    status: toPublicEnum(contact.status),
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  }
}

export type CustomerDocumentResource = {
  id: string
  customerId: string
  branchId: string
  documentType: string
  originalFilename: string
  byteSize: number
  mimeType: string
  /** First 8 characters of the file hash. The full hash and the storage key are never returned. */
  sha256Prefix: string
  /** The same file is already stored for another customer of the organization. */
  duplicateFileFlag: boolean
  issuedOn?: string
  expiresOn?: string
  status: string
  ocrStatus: string
  uploadedBy: string
  createdAt: string
  updatedAt: string
}

export function toDocumentResource(document: CustomerDocumentRecord): CustomerDocumentResource {
  return {
    id: document.id,
    customerId: document.customerId,
    branchId: document.branchId,
    documentType: toPublicEnum(document.documentType),
    originalFilename: document.originalFilename,
    byteSize: document.byteSize,
    mimeType: document.mimeType,
    sha256Prefix: document.sha256.slice(0, 8),
    duplicateFileFlag: document.duplicateFileFlag,
    issuedOn: optionalDateOnly(document.issuedOn),
    expiresOn: optionalDateOnly(document.expiresOn),
    status: toPublicEnum(document.status),
    ocrStatus: toPublicEnum(document.ocrStatus),
    uploadedBy: document.uploadedBy,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  }
}

export type OcrRunResource = {
  id: string
  documentId: string
  customerId: string
  provider: string
  modelVersion: string
  detectedType: string
  typeConfidence: number
  /** Values of identity-number fields are masked unless the caller may reveal them. */
  fields: Array<{ key: string; value: string; confidence: number }>
  status: string
  reviewedFields?: Array<{ key: string; value: string }>
  reviewStatus: string
  reviewedBy?: string
  reviewedAt?: string
  errorCode?: string
  createdAt: string
  updatedAt: string
}

export function toOcrRunResource(run: CustomerOcrRunRecord, reveal: boolean): OcrRunResource {
  return {
    id: run.id,
    documentId: run.documentId,
    customerId: run.customerId,
    provider: run.provider,
    modelVersion: run.modelVersion,
    detectedType: toPublicEnum(run.detectedType),
    typeConfidence: run.typeConfidence,
    fields: run.fields.map((field) => ({
      key: field.key,
      value: maskByKey(field.key, field.value, reveal),
      confidence: field.confidence,
    })),
    status: toPublicEnum(run.status),
    reviewedFields: run.reviewedFields?.map((field) => ({
      key: field.key,
      value: maskByKey(field.key, field.value, reveal),
    })),
    reviewStatus: toPublicEnum(run.reviewStatus),
    reviewedBy: run.reviewedBy,
    reviewedAt: run.reviewedAt?.toISOString(),
    errorCode: run.errorCode,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  }
}

export type DuplicateCandidateSummary = {
  id: string
  customerNumber: string
  displayName: string
  type: string
  status: string
  branchId: string
}

export type DuplicateReviewResource = {
  id: string
  /** The customer being viewed. */
  customerId: string
  /** The other customer of the pair. */
  candidateId: string
  status: string
  signals: string[]
  reviewedBy?: string
  reviewedAt?: string
  note?: string
  candidate: DuplicateCandidateSummary
  createdAt: string
  updatedAt: string
}

export function toCandidateSummary(customer: CustomerRecord): DuplicateCandidateSummary {
  return {
    id: customer.id,
    customerNumber: customer.customerNumber,
    displayName: customer.displayName,
    type: toPublicEnum(customer.type),
    status: toPublicEnum(customer.status),
    branchId: customer.branchId,
  }
}

/** Presents a canonical pair from the point of view of `viewedCustomerId`. */
export function toDuplicateReviewResource(
  review: DuplicateReviewRecord,
  viewedCustomerId: string,
  candidate: CustomerRecord,
): DuplicateReviewResource {
  return {
    id: review.id,
    customerId: viewedCustomerId,
    candidateId: candidate.id,
    status: toPublicEnum(review.status),
    signals: review.signals,
    reviewedBy: review.reviewedBy,
    reviewedAt: review.reviewedAt?.toISOString(),
    note: review.note,
    candidate: toCandidateSummary(candidate),
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  }
}
