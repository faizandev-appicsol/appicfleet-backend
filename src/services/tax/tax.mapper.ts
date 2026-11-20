import { toPublicEnum } from '../../constants/vehicles.js'

function iso(value?: Date | string) {
  if (!value) return undefined
  return value instanceof Date ? value.toISOString() : String(value)
}

export function toTaxCodeResource(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    organizationId: String(row.organizationId),
    legalEntityId: row.legalEntityId ? String(row.legalEntityId) : undefined,
    code: String(row.code),
    name: String(row.name),
    description: row.description ? String(row.description) : undefined,
    treatment: toPublicEnum(String(row.treatment)),
    isActive: Boolean(row.isActive),
    isSystem: Boolean(row.isSystem),
    createdAt: iso(row.createdAt as Date),
    updatedAt: iso(row.updatedAt as Date),
  }
}

export function toTaxRateResource(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    organizationId: String(row.organizationId),
    taxCodeId: String(row.taxCodeId),
    ratePercent: String(row.ratePercent),
    effectiveFrom: iso(row.effectiveFrom as Date),
    effectiveTo: iso(row.effectiveTo as Date | undefined),
    createdAt: iso(row.createdAt as Date),
  }
}

export function toTaxConfigurationResource(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    organizationId: String(row.organizationId),
    legalEntityId: String(row.legalEntityId),
    vatRegistrationStatus: toPublicEnum(String(row.vatRegistrationStatus)),
    vatRegistrationNumber: row.vatRegistrationNumber ? String(row.vatRegistrationNumber) : undefined,
    registeredName: row.registeredName ? String(row.registeredName) : undefined,
    registeredAddress: row.registeredAddress ? String(row.registeredAddress) : undefined,
    vatEffectiveDate: iso(row.vatEffectiveDate as Date | undefined),
    defaultTaxCodeId: row.defaultTaxCodeId ? String(row.defaultTaxCodeId) : undefined,
    defaultPricingMode: toPublicEnum(String(row.defaultPricingMode)),
    einvoicingEnabled: Boolean(row.einvoicingEnabled),
    einvoiceProvider: row.einvoiceProvider ? toPublicEnum(String(row.einvoiceProvider)) : undefined,
    einvoiceEnvironment: row.einvoiceEnvironment ? toPublicEnum(String(row.einvoiceEnvironment)) : undefined,
    updatedAt: iso(row.updatedAt as Date),
  }
}

export function toTaxPeriodResource(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    organizationId: String(row.organizationId),
    legalEntityId: String(row.legalEntityId),
    taxYear: Number(row.taxYear),
    name: String(row.name),
    periodNumber: Number(row.periodNumber),
    startDate: iso(row.startDate as Date),
    endDate: iso(row.endDate as Date),
    status: toPublicEnum(String(row.status)),
    lockReason: row.lockReason ? String(row.lockReason) : undefined,
    createdAt: iso(row.createdAt as Date),
  }
}

export function toTaxTransactionResource(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    organizationId: String(row.organizationId),
    legalEntityId: String(row.legalEntityId),
    branchId: String(row.branchId),
    sourceType: toPublicEnum(String(row.sourceType)),
    sourceId: String(row.sourceId),
    documentNumber: row.documentNumber ? String(row.documentNumber) : undefined,
    customerId: row.customerId ? String(row.customerId) : undefined,
    customerDisplayName: row.customerDisplayName ? String(row.customerDisplayName) : undefined,
    transactionDate: iso(row.transactionDate as Date),
    taxCodeId: row.taxCodeId ? String(row.taxCodeId) : undefined,
    taxCode: String(row.taxCode),
    taxRatePercent: String(row.taxRatePercent),
    taxTreatment: toPublicEnum(String(row.taxTreatment)),
    taxableAmount: String(row.taxableAmount),
    taxAmount: String(row.taxAmount),
    grossAmount: String(row.grossAmount),
    currency: String(row.currency),
    taxPeriodId: row.taxPeriodId ? String(row.taxPeriodId) : undefined,
    pricingMode: toPublicEnum(String(row.pricingMode)),
    createdAt: iso(row.createdAt as Date),
  }
}

export function toEInvoiceResource(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    organizationId: String(row.organizationId),
    legalEntityId: String(row.legalEntityId),
    branchId: String(row.branchId),
    sourceType: toPublicEnum(String(row.sourceType)),
    sourceId: String(row.sourceId),
    documentNumber: row.documentNumber ? String(row.documentNumber) : undefined,
    customerId: row.customerId ? String(row.customerId) : undefined,
    customerDisplayName: row.customerDisplayName ? String(row.customerDisplayName) : undefined,
    issueDate: iso(row.issueDate as Date),
    currency: String(row.currency),
    taxableAmount: String(row.taxableAmount),
    taxAmount: String(row.taxAmount),
    totalAmount: String(row.totalAmount),
    status: toPublicEnum(String(row.status)),
    provider: row.provider ? String(row.provider) : undefined,
    environment: row.environment ? toPublicEnum(String(row.environment)) : undefined,
    providerReference: row.providerReference ? String(row.providerReference) : undefined,
    documentVersion: Number(row.documentVersion),
    formatVersion: row.formatVersion ? String(row.formatVersion) : undefined,
    failureClass: row.failureClass ? toPublicEnum(String(row.failureClass)) : undefined,
    failureReason: row.failureReason ? String(row.failureReason) : undefined,
    validationErrors: Array.isArray(row.validationErrors) ? row.validationErrors : [],
    snapshot: row.snapshot,
    submittedAt: iso(row.submittedAt as Date | undefined),
    acceptedAt: iso(row.acceptedAt as Date | undefined),
    rejectedAt: iso(row.rejectedAt as Date | undefined),
    createdAt: iso(row.createdAt as Date),
    updatedAt: iso(row.updatedAt as Date),
  }
}

export function toEInvoiceSubmissionResource(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    einvoiceDocumentId: String(row.einvoiceDocumentId),
    attemptNumber: Number(row.attemptNumber),
    provider: String(row.provider),
    environment: toPublicEnum(String(row.environment)),
    status: toPublicEnum(String(row.status)),
    failureClass: row.failureClass ? toPublicEnum(String(row.failureClass)) : undefined,
    providerReference: row.providerReference ? String(row.providerReference) : undefined,
    responseCode: row.responseCode ? String(row.responseCode) : undefined,
    responseMessage: row.responseMessage ? String(row.responseMessage) : undefined,
    createdAt: iso(row.createdAt as Date),
  }
}
