import type { Types } from 'mongoose'
import type {
  ContactRole,
  ContactStatus,
  CustomerDocumentStatus,
  CustomerDocumentType,
  CustomerFileStatus,
  CustomerStatus,
  CustomerType,
  DuplicateReviewStatus,
  OcrReviewStatus,
  OcrRunStatus,
  OcrStatus,
} from '../constants/customers.js'

export interface ICustomerAddress {
  line1: string
  city: string
  country: string
}

export interface ICustomerIndividual {
  firstName: string
  middleName?: string
  lastName: string
  dateOfBirth?: Date
  nationality?: string
}

export interface ICustomerCorporate {
  legalName: string
  tradeName?: string
  registrationNumber?: string
  taxNumber?: string
}

export interface ICustomer {
  organizationId: Types.ObjectId
  legalEntityId: Types.ObjectId
  branchId: Types.ObjectId
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
  /** Lowercase email, used only to find duplicates. */
  normalizedEmail?: string
  /** Digits-only phone, used only to find duplicates. */
  normalizedPhone?: string
  documentStatus: CustomerDocumentStatus
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export interface ICustomerContact {
  customerId: Types.ObjectId
  organizationId: Types.ObjectId
  name: string
  phone?: string
  email?: string
  role: ContactRole
  /** Stored as entered; masked in API responses. */
  licenseNumber?: string
  licenseExpiresOn?: Date
  isPrimary: boolean
  status: ContactStatus
  createdAt: Date
  updatedAt: Date
}

export interface ICustomerDocument {
  customerId: Types.ObjectId
  organizationId: Types.ObjectId
  branchId: Types.ObjectId
  documentType: CustomerDocumentType
  /** Opaque random key into the storage service. Never a URL or the original filename. */
  storageKey: string
  originalFilename: string
  byteSize: number
  mimeType: string
  sha256: string
  /** True when the same file is already stored for a different customer of the organization. */
  duplicateFileFlag: boolean
  issuedOn?: Date
  expiresOn?: Date
  status: CustomerFileStatus
  uploadedBy: Types.ObjectId
  ocrStatus: OcrStatus
  createdAt: Date
  updatedAt: Date
}

export interface IOcrField {
  key: string
  value: string
  confidence: number
}

export interface IOcrReviewedField {
  key: string
  value: string
}

export interface ICustomerOcrRun {
  documentId: Types.ObjectId
  customerId: Types.ObjectId
  organizationId: Types.ObjectId
  provider: string
  modelVersion: string
  detectedType: CustomerDocumentType
  typeConfidence: number
  /** RAW extracted values. Only ever returned masked unless the caller may reveal them. */
  fields: IOcrField[]
  status: OcrRunStatus
  reviewedFields?: IOcrReviewedField[]
  reviewStatus: OcrReviewStatus
  reviewedBy?: Types.ObjectId
  reviewedAt?: Date
  errorCode?: string
  createdAt: Date
  updatedAt: Date
}

export interface ICustomerDuplicateReview {
  organizationId: Types.ObjectId
  /** Canonical pair: customerId < candidateId (hex string order). Query either side. */
  customerId: Types.ObjectId
  candidateId: Types.ObjectId
  status: DuplicateReviewStatus
  signals: string[]
  reviewedBy?: Types.ObjectId
  reviewedAt?: Date
  note?: string
  createdAt: Date
  updatedAt: Date
}
