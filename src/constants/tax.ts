/** Module 12 — UAE VAT + e-invoicing foundation. Stored UPPERCASE; API lowercase via toPublicEnum.
 * Rates and treatments are configurable — do not hard-code legal classifications in business logic.
 */

export const TAX_TREATMENTS = {
  STANDARD_RATED: 'STANDARD_RATED',
  ZERO_RATED: 'ZERO_RATED',
  EXEMPT: 'EXEMPT',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
  REVERSE_CHARGE: 'REVERSE_CHARGE',
} as const
export type TaxTreatment = (typeof TAX_TREATMENTS)[keyof typeof TAX_TREATMENTS]

export const TAX_PRICING_MODES = {
  EXCLUSIVE: 'EXCLUSIVE',
  INCLUSIVE: 'INCLUSIVE',
} as const
export type TaxPricingMode = (typeof TAX_PRICING_MODES)[keyof typeof TAX_PRICING_MODES]

export const VAT_REGISTRATION_STATUSES = {
  NOT_REGISTERED: 'NOT_REGISTERED',
  REGISTERED: 'REGISTERED',
  SUSPENDED: 'SUSPENDED',
} as const
export type VatRegistrationStatus = (typeof VAT_REGISTRATION_STATUSES)[keyof typeof VAT_REGISTRATION_STATUSES]

export const TAX_PERIOD_STATUSES = {
  OPEN: 'OPEN',
  LOCKED: 'LOCKED',
  FILED: 'FILED',
} as const
export type TaxPeriodStatus = (typeof TAX_PERIOD_STATUSES)[keyof typeof TAX_PERIOD_STATUSES]

export const TAX_SOURCE_TYPES = {
  INVOICE: 'INVOICE',
  CREDIT_NOTE: 'CREDIT_NOTE',
  DEBIT_NOTE: 'DEBIT_NOTE',
} as const
export type TaxSourceType = (typeof TAX_SOURCE_TYPES)[keyof typeof TAX_SOURCE_TYPES]

export const EINVOICE_STATUSES = {
  NOT_READY: 'NOT_READY',
  READY: 'READY',
  GENERATED: 'GENERATED',
  VALIDATING: 'VALIDATING',
  SUBMITTED: 'SUBMITTED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const
export type EInvoiceStatus = (typeof EINVOICE_STATUSES)[keyof typeof EINVOICE_STATUSES]

export const EINVOICE_FAILURE_CLASSES = {
  TRANSIENT: 'TRANSIENT',
  PERMANENT: 'PERMANENT',
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  PROVIDER_REJECTION: 'PROVIDER_REJECTION',
} as const
export type EInvoiceFailureClass = (typeof EINVOICE_FAILURE_CLASSES)[keyof typeof EINVOICE_FAILURE_CLASSES]

export const EINVOICE_ENVIRONMENTS = {
  TEST: 'TEST',
  SANDBOX: 'SANDBOX',
  PRODUCTION: 'PRODUCTION',
} as const
export type EInvoiceEnvironment = (typeof EINVOICE_ENVIRONMENTS)[keyof typeof EINVOICE_ENVIRONMENTS]

export const EINVOICE_PROVIDERS = {
  SANDBOX: 'SANDBOX',
} as const

/** Seed codes are examples only — rates/treatments remain configurable. */
export const DEFAULT_TAX_CODE_SEEDS: ReadonlyArray<{
  code: string
  name: string
  description: string
  treatment: TaxTreatment
  ratePercent: string
}> = [
  {
    code: 'STANDARD',
    name: 'Standard rated',
    description: 'Configurable standard-rated supply. Rate is organization-configured, not a legal hard-code.',
    treatment: TAX_TREATMENTS.STANDARD_RATED,
    ratePercent: '5.00',
  },
  {
    code: 'ZERO_RATED',
    name: 'Zero rated',
    description: 'Configurable zero-rated supply.',
    treatment: TAX_TREATMENTS.ZERO_RATED,
    ratePercent: '0.00',
  },
  {
    code: 'EXEMPT',
    name: 'Exempt',
    description: 'Configurable exempt supply.',
    treatment: TAX_TREATMENTS.EXEMPT,
    ratePercent: '0.00',
  },
  {
    code: 'OUT_OF_SCOPE',
    name: 'Out of scope',
    description: 'Configurable out-of-scope supply.',
    treatment: TAX_TREATMENTS.OUT_OF_SCOPE,
    ratePercent: '0.00',
  },
]

export const TAX_CODE_SORT_FIELDS = ['code', 'name', 'createdAt', 'isActive'] as const
export const TAX_TRANSACTION_SORT_FIELDS = ['transactionDate', 'documentNumber', 'createdAt'] as const
export const EINVOICE_SORT_FIELDS = ['issueDate', 'documentNumber', 'createdAt', 'status'] as const

export const DEFAULT_CURRENCY = 'AED'
