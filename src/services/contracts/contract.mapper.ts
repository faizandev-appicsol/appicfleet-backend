import { toPublicEnum } from '../../constants/vehicles.js'
import type { ContractRecord } from '../../repositories/contracts/contract.repository.js'
import type { VehicleAssignmentRecord } from '../../repositories/vehicles/vehicle-assignment.repository.js'
import { selectBillableCharges } from './contract-rules.js'

type Row = Record<string, unknown>

function idOf(value: unknown): string {
  if (value && typeof value === 'object' && 'toString' in value) return String(value)
  return String(value ?? '')
}

function iso(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return undefined
}

export function toContractResource(contract: ContractRecord) {
  return {
    id: contract.id,
    contractNumber: contract.contractNumber,
    organizationId: contract.organizationId,
    legalEntityId: contract.legalEntityId,
    branchId: contract.branchId,
    type: toPublicEnum(contract.type),
    status: toPublicEnum(contract.status),
    customerId: contract.customerId,
    customerName: contract.customerSnapshot?.displayName,
    customerType: contract.customerSnapshot ? toPublicEnum(contract.customerSnapshot.type) : undefined,
    companyName: contract.customerSnapshot?.companyName,
    bookingId: contract.bookingId,
    currentVehicleId: contract.currentVehicleId,
    currentPlate: contract.currentPlate,
    startsAt: contract.startsAt.toISOString(),
    endsAt: contract.endsAt.toISOString(),
    originalEndsAt: contract.originalEndsAt?.toISOString(),
    currency: contract.currency,
    driverName: contract.driverName,
    authorizedContactName: contract.authorizedContactName,
    lenderName: contract.lenderName,
    borrowCost: contract.borrowCost,
    notes: contract.notes,
    acceptedTermsVersionId: contract.acceptedTermsVersionId,
    approvedAt: contract.approvedAt?.toISOString(),
    activatedAt: contract.activatedAt?.toISOString(),
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
  }
}

function chargeOf(row: Row) {
  return {
    id: idOf(row._id),
    kind: toPublicEnum(String(row.kind)),
    sourceId: String(row.sourceId),
    supersededBy: row.supersededBy ? String(row.supersededBy) : undefined,
    currency: String(row.currency),
    unitAmount: String(row.unitAmount),
    quantityDays: Number(row.quantityDays),
    totalAmount: String(row.totalAmount),
    rateType: toPublicEnum(String(row.rateType)),
    periodStart: iso(row.periodStart),
    periodEnd: iso(row.periodEnd),
  }
}

export function toContractDetail(input: {
  contract: ContractRecord
  assignments: VehicleAssignmentRecord[]
  charges: Row[]
  terms: Row[]
  signatures: Row[]
  extensions: Row[]
  replacements: Row[]
  amendments: Row[]
  handover: Row | null
  vehicleReturn: Row | null
  history: Row[]
}) {
  const charges = input.charges.map(chargeOf)
  return {
    ...toContractResource(input.contract),
    assignments: input.assignments.map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      vehiclePlate: row.vehiclePlate,
      branchId: row.branchId,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      plannedEndsAt: row.plannedEndsAt?.toISOString(),
      closedAt: row.closedAt?.toISOString(),
      status: toPublicEnum(row.status),
      assignmentType: row.assignmentType ? toPublicEnum(row.assignmentType) : undefined,
      sourceAssignmentId: row.sourceAssignmentId,
      reason: row.reason,
    })),
    charges,
    billableCharges: selectBillableCharges(charges),
    terms: input.terms.map((row) => ({
      id: idOf(row._id),
      version: Number(row.version),
      content: String(row.content),
      status: toPublicEnum(String(row.status)),
      effectiveAt: iso(row.effectiveAt),
      createdAt: iso(row.createdAt),
    })),
    signatures: input.signatures.map((row) => ({
      id: idOf(row._id),
      termsVersionId: idOf(row.termsVersionId),
      signerName: String(row.signerName),
      status: toPublicEnum(String(row.status)),
      provider: String(row.provider),
      signedAt: iso(row.signedAt),
    })),
    extensions: input.extensions.map((row) => ({
      id: idOf(row._id),
      startsAt: iso(row.startsAt),
      endsAt: iso(row.endsAt),
      currency: String(row.currency),
      unitAmount: String(row.unitAmount),
      quantityDays: Number(row.quantityDays),
      totalAmount: String(row.totalAmount),
    })),
    replacements: input.replacements.map((row) => ({
      id: idOf(row._id),
      previousVehicleId: idOf(row.previousVehicleId),
      replacementVehicleId: idOf(row.replacementVehicleId),
      previousAssignmentId: idOf(row.previousAssignmentId),
      replacementAssignmentId: idOf(row.replacementAssignmentId),
      previousPlate: String(row.previousPlate),
      replacementPlate: String(row.replacementPlate),
      reason: String(row.reason),
      status: toPublicEnum(String(row.status)),
      occurredAt: iso(row.occurredAt),
    })),
    amendments: input.amendments.map((row) => ({
      id: idOf(row._id),
      previousTotal: String(row.previousTotal),
      newUnitAmount: String(row.newUnitAmount),
      newTotal: String(row.newTotal),
      currency: String(row.currency),
      reason: String(row.reason),
      effectiveAt: iso(row.effectiveAt),
    })),
    handover: input.handover
      ? {
          occurredAt: iso(input.handover.occurredAt),
          mileageKm: Number(input.handover.mileageKm),
          fuelPercent: Number(input.handover.fuelPercent),
          condition: String(input.handover.condition),
          notes: input.handover.notes ? String(input.handover.notes) : undefined,
          acknowledged: Boolean(input.handover.acknowledged),
        }
      : undefined,
    vehicleReturn: input.vehicleReturn
      ? {
          occurredAt: iso(input.vehicleReturn.occurredAt),
          mileageKm: Number(input.vehicleReturn.mileageKm),
          fuelPercent: Number(input.vehicleReturn.fuelPercent),
          condition: String(input.vehicleReturn.condition),
          damageNotes: input.vehicleReturn.damageNotes ? String(input.vehicleReturn.damageNotes) : undefined,
          notes: input.vehicleReturn.notes ? String(input.vehicleReturn.notes) : undefined,
          acknowledged: Boolean(input.vehicleReturn.acknowledged),
        }
      : undefined,
    history: input.history.map((row) => ({
      id: idOf(row._id),
      fromStatus: row.fromStatus ? toPublicEnum(String(row.fromStatus)) : undefined,
      toStatus: toPublicEnum(String(row.toStatus)),
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: iso(row.createdAt),
    })),
  }
}

export type ContractDetail = ReturnType<typeof toContractDetail>
