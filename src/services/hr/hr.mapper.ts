import { toPublicEnum } from '../../constants/vehicles.js'
import { redactFields } from '../field-access/field-access.service.js'
import type {
  DepartmentRecord,
  EmployeeRecord,
  HrDocumentRecord,
  HrHistoryRecord,
  PositionRecord,
} from '../../repositories/hr/hr.repository.js'

export function toDepartmentResource(row: DepartmentRecord) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId ?? null,
    name: row.name,
    code: row.code,
    description: row.description ?? null,
    managerEmployeeId: row.managerEmployeeId ?? null,
    status: toPublicEnum(row.status as never),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toPositionResource(row: PositionRecord) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalEntityId: row.legalEntityId,
    departmentId: row.departmentId ?? null,
    name: row.name,
    code: row.code,
    description: row.description ?? null,
    status: toPublicEnum(row.status as never),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toEmployeeResource(row: EmployeeRecord, sensitiveAllowed: boolean) {
  const base = {
    id: row.id,
    organizationId: row.organizationId,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    employeeNumber: row.employeeNumber,
    firstName: row.firstName,
    middleName: row.middleName ?? null,
    lastName: row.lastName,
    preferredName: row.preferredName ?? null,
    dateOfBirth: row.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    nationality: row.nationality ?? null,
    personalEmail: row.personalEmail ?? null,
    workEmail: row.workEmail ?? null,
    personalPhone: row.personalPhone ?? null,
    workPhone: row.workPhone ?? null,
    status: toPublicEnum(row.status as never),
    employmentType: toPublicEnum(row.employmentType as never),
    jobTitle: row.jobTitle ?? null,
    departmentId: row.departmentId ?? null,
    positionId: row.positionId ?? null,
    managerEmployeeId: row.managerEmployeeId ?? null,
    userId: row.userId ?? null,
    hireDate: row.hireDate?.toISOString().slice(0, 10) ?? null,
    probationStartsAt: row.probationStartsAt?.toISOString() ?? null,
    probationEndsAt: row.probationEndsAt?.toISOString() ?? null,
    employmentStartsAt: row.employmentStartsAt?.toISOString() ?? null,
    employmentEndsAt: row.employmentEndsAt?.toISOString() ?? null,
    addresses: sensitiveAllowed
      ? row.addresses.map((address) => ({
          id: address.id,
          type: toPublicEnum(address.type as never),
          country: address.country ?? null,
          city: address.city ?? null,
          region: address.region ?? null,
          line1: address.line1 ?? null,
          line2: address.line2 ?? null,
          postalCode: address.postalCode ?? null,
          isPrimary: address.isPrimary,
        }))
      : [],
    emergencyContacts: sensitiveAllowed
      ? row.emergencyContacts.map((contact) => ({
          id: contact.id,
          name: contact.name,
          relationship: contact.relationship ?? null,
          phone: contact.phone ?? null,
          email: contact.email ?? null,
          isPrimary: contact.isPrimary,
        }))
      : [],
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }

  return redactFields(
    base,
    ['dateOfBirth', 'nationality', 'personalEmail', 'personalPhone', 'notes'],
    sensitiveAllowed,
  )
}

export function toDocumentResource(row: HrDocumentRecord) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    employeeId: row.employeeId,
    documentType: toPublicEnum(row.documentType as never),
    documentNumber: row.documentNumber ?? null,
    issuedOn: row.issuedOn?.toISOString().slice(0, 10) ?? null,
    expiresOn: row.expiresOn?.toISOString().slice(0, 10) ?? null,
    issuingAuthority: row.issuingAuthority ?? null,
    originalFilename: row.originalFilename,
    byteSize: row.byteSize,
    mimeType: row.mimeType,
    status: toPublicEnum(row.status as never),
    notes: row.notes ?? null,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toHistoryResource(row: HrHistoryRecord) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    kind: toPublicEnum(row.kind as never),
    previousValue: row.previousValue ?? null,
    newValue: row.newValue ?? null,
    effectiveAt: row.effectiveAt.toISOString(),
    reason: row.reason ?? null,
    changedBy: row.changedBy,
    createdAt: row.createdAt.toISOString(),
  }
}
