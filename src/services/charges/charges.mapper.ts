import { toPublicEnum } from '../../constants/vehicles.js'
import type { FineRecord, RefundRecord, TollRecord } from '../../repositories/charges/charges.repository.js'

function iso(value?: Date) {
  return value ? value.toISOString() : undefined
}
function idOf(value: unknown) {
  return value && typeof value === 'object' && 'toString' in value ? String(value) : String(value ?? '')
}

export function toFineResource(fine: FineRecord) {
  return {
    id: fine.id,
    documentNumber: fine.documentNumber,
    organizationId: fine.organizationId,
    legalEntityId: fine.legalEntityId,
    branchId: fine.branchId,
    externalReference: fine.externalReference,
    provider: fine.provider,
    fineType: toPublicEnum(fine.fineType),
    source: toPublicEnum(fine.source),
    eventAt: fine.eventAt.toISOString(),
    receivedAt: fine.receivedAt.toISOString(),
    vehicleId: fine.vehicleId,
    vehiclePlate: fine.vehiclePlate,
    assignmentId: fine.assignmentId,
    contractId: fine.contractId,
    customerId: fine.customerId,
    customerName: fine.customerName,
    assignmentResolution: toPublicEnum(fine.assignmentResolution),
    reviewReason: fine.reviewReason,
    currency: fine.currency,
    amount: fine.amount,
    description: fine.description,
    location: fine.location,
    authority: fine.authority,
    status: toPublicEnum(fine.status),
    recoveryId: fine.recoveryId,
    recoveryAmount: fine.recoveryAmount,
    createdAt: fine.createdAt.toISOString(),
    updatedAt: fine.updatedAt.toISOString(),
  }
}

export function toFineDetail(fine: FineRecord, history: Array<Record<string, unknown>>, disputes: Array<Record<string, unknown>>) {
  return {
    ...toFineResource(fine),
    history: history.map((row) => ({
      id: idOf(row._id),
      fromStatus: row.fromStatus ? toPublicEnum(String(row.fromStatus)) : undefined,
      toStatus: toPublicEnum(String(row.toStatus)),
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: iso(row.createdAt as Date),
    })),
    disputes: disputes.map((row) => ({
      id: idOf(row._id),
      status: toPublicEnum(String(row.status)),
      reason: String(row.reason),
      description: row.description ? String(row.description) : undefined,
      resolution: row.resolution ? String(row.resolution) : undefined,
      createdAt: iso(row.createdAt as Date),
      resolvedAt: iso(row.resolvedAt as Date | undefined),
    })),
  }
}

export function toTollResource(toll: TollRecord) {
  return {
    id: toll.id,
    documentNumber: toll.documentNumber,
    organizationId: toll.organizationId,
    legalEntityId: toll.legalEntityId,
    branchId: toll.branchId,
    externalReference: toll.externalReference,
    provider: toPublicEnum(toll.provider),
    source: toPublicEnum(toll.source),
    eventAt: toll.eventAt.toISOString(),
    receivedAt: toll.receivedAt.toISOString(),
    vehicleId: toll.vehicleId,
    vehiclePlate: toll.vehiclePlate,
    assignmentId: toll.assignmentId,
    contractId: toll.contractId,
    customerId: toll.customerId,
    customerName: toll.customerName,
    assignmentResolution: toPublicEnum(toll.assignmentResolution),
    reviewReason: toll.reviewReason,
    currency: toll.currency,
    amount: toll.amount,
    location: toll.location,
    gate: toll.gate,
    description: toll.description,
    status: toPublicEnum(toll.status),
    recoveryId: toll.recoveryId,
    recoveryAmount: toll.recoveryAmount,
    createdAt: toll.createdAt.toISOString(),
    updatedAt: toll.updatedAt.toISOString(),
  }
}

export function toTollDetail(toll: TollRecord, history: Array<Record<string, unknown>>, disputes: Array<Record<string, unknown>>) {
  return {
    ...toTollResource(toll),
    history: history.map((row) => ({
      id: idOf(row._id),
      fromStatus: row.fromStatus ? toPublicEnum(String(row.fromStatus)) : undefined,
      toStatus: toPublicEnum(String(row.toStatus)),
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: iso(row.createdAt as Date),
    })),
    disputes: disputes.map((row) => ({
      id: idOf(row._id),
      status: toPublicEnum(String(row.status)),
      reason: String(row.reason),
      description: row.description ? String(row.description) : undefined,
      resolution: row.resolution ? String(row.resolution) : undefined,
      createdAt: iso(row.createdAt as Date),
      resolvedAt: iso(row.resolvedAt as Date | undefined),
    })),
  }
}

export function toRefundResource(refund: RefundRecord) {
  return {
    id: refund.id,
    documentNumber: refund.documentNumber,
    organizationId: refund.organizationId,
    legalEntityId: refund.legalEntityId,
    branchId: refund.branchId,
    customerId: refund.customerId,
    customerName: refund.customerName,
    contractId: refund.contractId,
    sourceKind: toPublicEnum(refund.sourceKind),
    depositId: refund.depositId,
    paymentId: refund.paymentId,
    currency: refund.currency,
    amount: refund.amount,
    reason: refund.reason,
    notes: refund.notes,
    status: toPublicEnum(refund.status),
    externalReference: refund.externalReference,
    requestedAt: iso(refund.requestedAt),
    approvedAt: iso(refund.approvedAt),
    executedAt: iso(refund.executedAt),
    failedReason: refund.failedReason,
    createdAt: refund.createdAt.toISOString(),
    updatedAt: refund.updatedAt.toISOString(),
  }
}

export function toImportBatchResource(row: Record<string, unknown>) {
  return {
    id: idOf(row._id),
    documentNumber: row.documentNumber ? String(row.documentNumber) : undefined,
    organizationId: idOf(row.organizationId),
    legalEntityId: idOf(row.legalEntityId),
    branchId: idOf(row.branchId),
    provider: String(row.provider),
    kind: toPublicEnum(String(row.kind)),
    fileName: row.fileName ? String(row.fileName) : undefined,
    status: toPublicEnum(String(row.status)),
    totalRows: Number(row.totalRows ?? 0),
    successRows: Number(row.successRows ?? 0),
    duplicateRows: Number(row.duplicateRows ?? 0),
    failedRows: Number(row.failedRows ?? 0),
    reviewRows: Number(row.reviewRows ?? 0),
    errorSummary: row.errorSummary ? String(row.errorSummary) : undefined,
    createdAt: iso(row.createdAt as Date),
    completedAt: iso(row.completedAt as Date | undefined),
  }
}
