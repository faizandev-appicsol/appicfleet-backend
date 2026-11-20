/**
 * Module 16 — HR & Employee Management.
 * Employees are business records, not login Users. Linking to a User is optional.
 */

export const EMPLOYMENT_STATUSES = {
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED',
  RESIGNED: 'RESIGNED',
  RETIRED: 'RETIRED',
} as const
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[keyof typeof EMPLOYMENT_STATUSES]

export const EMPLOYMENT_TYPES = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  CONTRACT: 'CONTRACT',
  TEMPORARY: 'TEMPORARY',
  INTERN: 'INTERN',
} as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[keyof typeof EMPLOYMENT_TYPES]

export const HR_ENTITY_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const
export type HrEntityStatus = (typeof HR_ENTITY_STATUSES)[keyof typeof HR_ENTITY_STATUSES]

export const HR_DOCUMENT_TYPES = {
  PASSPORT: 'PASSPORT',
  EMIRATES_ID: 'EMIRATES_ID',
  VISA: 'VISA',
  LABOUR_PERMIT: 'LABOUR_PERMIT',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
  EMPLOYMENT_CONTRACT: 'EMPLOYMENT_CONTRACT',
  INSURANCE: 'INSURANCE',
  QUALIFICATION: 'QUALIFICATION',
  OTHER: 'OTHER',
} as const
export type HrDocumentType = (typeof HR_DOCUMENT_TYPES)[keyof typeof HR_DOCUMENT_TYPES]

export const HR_DOCUMENT_STATUSES = {
  VALID: 'VALID',
  EXPIRING_SOON: 'EXPIRING_SOON',
  EXPIRED: 'EXPIRED',
  ARCHIVED: 'ARCHIVED',
} as const
export type HrDocumentStatus = (typeof HR_DOCUMENT_STATUSES)[keyof typeof HR_DOCUMENT_STATUSES]

export const HR_ADDRESS_TYPES = {
  HOME: 'HOME',
  WORK: 'WORK',
  OTHER: 'OTHER',
} as const
export type HrAddressType = (typeof HR_ADDRESS_TYPES)[keyof typeof HR_ADDRESS_TYPES]

export const HR_HISTORY_KINDS = {
  STATUS: 'STATUS',
  POSITION: 'POSITION',
  DEPARTMENT: 'DEPARTMENT',
  BRANCH: 'BRANCH',
  LEGAL_ENTITY: 'LEGAL_ENTITY',
  MANAGER: 'MANAGER',
  TRANSFER: 'TRANSFER',
  USER_LINK: 'USER_LINK',
  USER_UNLINK: 'USER_UNLINK',
} as const
export type HrHistoryKind = (typeof HR_HISTORY_KINDS)[keyof typeof HR_HISTORY_KINDS]

export const EMPLOYEE_SORT_FIELDS = [
  'employeeNumber',
  'lastName',
  'firstName',
  'hireDate',
  'status',
  'createdAt',
] as const
export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number]

/** Days before expiry when a document becomes EXPIRING_SOON (configurable via env later). */
export const HR_DOCUMENT_EXPIRY_WARNING_DAYS = Number(
  process.env.HR_DOCUMENT_EXPIRY_WARNING_DAYS ?? 30,
)

/** Sensitive employee fields require `hr.employee.sensitive.view`. */
export const EMPLOYEE_SENSITIVE_FIELDS = [
  'dateOfBirth',
  'nationality',
  'personalEmail',
  'personalPhone',
  'emergencyContacts',
  'addresses',
] as const
