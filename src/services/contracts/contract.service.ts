import {
  ASSIGNMENT_TYPES,
  CHARGE_KINDS,
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  REPLACEMENT_STATUSES,
  SIGNATURE_STATUSES,
  type ContractStatus,
  type ContractType,
} from '../../constants/contracts.js'
import { CUSTOMER_STATUSES, CUSTOMER_TYPES } from '../../constants/customers.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { ASSIGNMENT_STATUSES, OWNERSHIP_TYPES, toPublicEnum } from '../../constants/vehicles.js'
import { findBookingById, transitionBooking } from '../../repositories/bookings/booking.repository.js'
import {
  acceptTerms,
  allocateContractNumber,
  attachContractKey,
  claimContractKey,
  contractIdForKey,
  findContractByBookingId,
  findExtensionWindow,
  findHandover,
  findReplacementAt,
  findReturn,
  findSignatureByEvent,
  findSignedTerms,
  hashContractRequest,
  insertAmendment,
  insertCharge,
  insertContract,
  insertExtension,
  insertHandover,
  insertReplacement,
  insertReturn,
  insertSignature,
  insertStatusEvent,
  insertTerms,
  latestTerms,
  listAmendments,
  listCharges,
  listContracts,
  listExtensions,
  listReplacements,
  listSignatures,
  listStatusEvents,
  listTerms,
  releaseContractKey,
  supersedeCharge,
  transitionContract,
  updateDraftContract,
  updateDraftTerms,
  type ContractRecord,
  type CustomerSnapshot,
} from '../../repositories/contracts/contract.repository.js'
import { findCustomerById } from '../../repositories/customers/customer.repository.js'
import {
  findActiveAssignmentsOverlapping,
  insertVehicleAssignment,
  linkAssignmentToContract,
  listAssignmentsForContract,
  moveAssignmentEnd,
  releaseVehicleAssignment,
  type VehicleAssignmentRecord,
} from '../../repositories/vehicles/vehicle-assignment.repository.js'
import { findVehicleById, type VehicleRecord } from '../../repositories/vehicles/vehicle.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { multiplyMoney } from '../../utils/money.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { BOOKING_STATUSES } from '../../constants/bookings.js'
import type {
  AmendPricingBody,
  CreateContractBody,
  ExtendContractBody,
  HandoverBody,
  ListContractsQuery,
  ReplaceVehicleBody,
  ReturnBody,
  SignatureBody,
  SignatureCallbackBody,
  UpdateContractBody,
} from '../../validations/contract.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess } from '../authorization/authorization.service.js'
import { loadAccessibleBooking } from '../bookings/booking-access.js'
import { billableDays } from '../bookings/booking-rules.js'
import { canAccessCustomer } from '../customers/customer-access.js'
import { decideAssignment } from '../vehicles/availability-rules.js'
import { isNonOperationalStatus } from '../vehicles/status-rules.js'
import { withVehicleLock } from '../vehicles/vehicle-lock.service.js'
import { canAccessContract, isOrganizationWide, loadAccessibleContract, resolveContractOrganization } from './contract-access.js'
import { quoteContractWindow } from './contract-pricing.js'
import {
  canTransition,
  extensionContinuity,
  freezeSnapshot,
  requiredCustomerType,
  selectBillableCharges,
} from './contract-rules.js'
import { toContractDetail, toContractResource, type ContractDetail } from './contract.mapper.js'

function assertMove(from: ContractStatus, to: ContractStatus): void {
  if (!canTransition(from, to)) {
    throw invalidField('status', `A contract cannot move from ${toPublicEnum(from)} to ${toPublicEnum(to)}`)
  }
}

async function requireCustomer(ctx: AccessContext, customerId: string, organizationId: string, type: ContractType) {
  const customer = await findCustomerById(customerId)
  if (!customer || customer.organizationId !== organizationId || !canAccessCustomer(ctx, customer)) {
    throw notFound('Customer was not found.')
  }
  if (customer.status !== CUSTOMER_STATUSES.ACTIVE) {
    throw invalidField('customerId', 'The customer must be active.')
  }
  const required = requiredCustomerType(type)
  if (required && customer.type !== required) {
    throw invalidField('customerId', `This contract type requires a ${toPublicEnum(required)} customer.`)
  }
  return customer
}

async function requireVehicle(ctx: AccessContext, vehicleId: string, organizationId: string, type: ContractType) {
  const vehicle = await findVehicleById(vehicleId)
  if (!vehicle || vehicle.organizationId !== organizationId || !canAccessContract(ctx, {
    organizationId: vehicle.organizationId,
    branchId: vehicle.branchId,
    legalEntityId: vehicle.legalEntityId,
  } as ContractRecord)) {
    throw notFound('Vehicle was not found.')
  }
  if (type === CONTRACT_TYPES.BORROW && vehicle.ownershipType !== OWNERSHIP_TYPES.BORROWED) {
    throw invalidField('vehicleId', 'A borrow contract requires a borrowed vehicle.')
  }
  return vehicle
}

function snapshotOf(customer: {
  customerNumber: string
  displayName: string
  type: string
  email?: string
  phone?: string
  corporate?: { legalName?: string }
}): CustomerSnapshot {
  return freezeSnapshot({
    customerNumber: customer.customerNumber,
    displayName: customer.displayName,
    type: customer.type,
    email: customer.email,
    phone: customer.phone,
    companyName: customer.corporate?.legalName,
  })
}

async function writeHistory(
  contract: ContractRecord,
  from: ContractStatus | undefined,
  to: ContractStatus,
  reason: string | undefined,
  actorUserId: string,
) {
  if (from === to) return
  await insertStatusEvent({
    contractId: contract.id,
    organizationId: contract.organizationId,
    branchId: contract.branchId,
    fromStatus: from,
    toStatus: to,
    reason,
    actorUserId,
  })
}

async function audit(
  action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
  contract: ContractRecord,
  actorUserId: string | undefined,
  meta: RequestMeta | undefined,
  metadata: Record<string, unknown>,
) {
  await recordAuditEvent({
    action,
    entityType: AUDIT_ENTITY_TYPES.CONTRACT,
    entityId: contract.id,
    actorUserId,
    organizationId: contract.organizationId,
    branchId: contract.branchId,
    metadata,
    meta,
  })
}

function openAssignment(rows: VehicleAssignmentRecord[]): VehicleAssignmentRecord | undefined {
  return rows
    .filter((row) => row.status === ASSIGNMENT_STATUSES.ACTIVE)
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0]
}

async function detail(contract: ContractRecord): Promise<ContractDetail> {
  const [assignments, charges, terms, signatures, extensions, replacements, amendments, handover, vehicleReturn, history] =
    await Promise.all([
      listAssignmentsForContract(contract.id, contract.organizationId),
      listCharges(contract.id),
      listTerms(contract.id),
      listSignatures(contract.id),
      listExtensions(contract.id),
      listReplacements(contract.id),
      listAmendments(contract.id),
      findHandover(contract.id),
      findReturn(contract.id),
      listStatusEvents(contract.id),
    ])
  return toContractDetail({
    contract,
    assignments,
    charges,
    terms,
    signatures,
    extensions,
    replacements,
    amendments,
    handover,
    vehicleReturn,
    history,
  })
}

export async function listContractDirectory(ctx: AccessContext, query: ListContractsQuery) {
  assertPermission(ctx, PERMISSIONS.CONTRACT_VIEW)
  const organizationId = resolveContractOrganization(ctx, query.organizationId)
  if (query.branchId && !hasBranchAccess(ctx, query.branchId, organizationId)) {
    throw notFound('Branch was not found.')
  }
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listContracts({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search,
    status: query.status,
    type: query.type,
    branchId: query.branchId,
    customerId: query.customerId,
    vehicleId: query.vehicleId,
    startsFrom: query.startsFrom,
    startsTo: query.startsTo,
    activeOnly: query.activeOnly,
    sort: query.sort ?? 'createdAt',
    order: query.order ?? 'desc',
  })
  return toPaginated(page.items.map(toContractResource), pagination.page, pagination.limit, page.total)
}

export async function getContract(ctx: AccessContext, id: string): Promise<ContractDetail> {
  assertPermission(ctx, PERMISSIONS.CONTRACT_VIEW)
  return detail(await loadAccessibleContract(ctx, id))
}

export async function quoteForCaller(
  ctx: AccessContext,
  input: { vehicleId: string; startsAt: Date; endsAt: Date; organizationId?: string },
) {
  assertPermission(ctx, PERMISSIONS.CONTRACT_VIEW)
  const organizationId = resolveContractOrganization(ctx, input.organizationId)
  const vehicle = await requireVehicle(ctx, input.vehicleId, organizationId, CONTRACT_TYPES.B2C)
  const quote = await quoteContractWindow({
    vehicleId: vehicle.id,
    organizationId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    kind: CHARGE_KINDS.RENTAL,
  })
  return quote ?? null
}

export async function createDraft(
  ctx: AccessContext,
  input: CreateContractBody,
  meta: RequestMeta,
): Promise<ContractDetail> {
  assertPermission(ctx, PERMISSIONS.CONTRACT_CREATE)
  const organizationId = resolveContractOrganization(ctx, input.organizationId)
  if (input.endsAt.getTime() <= input.startsAt.getTime()) {
    throw invalidField('endsAt', 'Return must be after pickup.')
  }
  const customer = await requireCustomer(ctx, input.customerId, organizationId, input.type)
  const vehicle = input.vehicleId
    ? await requireVehicle(ctx, input.vehicleId, organizationId, input.type)
    : undefined
  const branchId = vehicle?.branchId ?? customer.branchId
  if (!canAccessContract(ctx, {
    organizationId,
    branchId,
    legalEntityId: vehicle?.legalEntityId ?? customer.legalEntityId,
  } as ContractRecord)) {
    throw notFound('Branch was not found.')
  }
  const contractNumber = await allocateContractNumber(organizationId)
  const contract = await insertContract({
    organizationId,
    legalEntityId: vehicle?.legalEntityId ?? customer.legalEntityId,
    branchId,
    contractNumber,
    type: input.type,
    status: CONTRACT_STATUSES.DRAFT,
    customerId: customer.id,
    customerSnapshot: snapshotOf(customer),
    currentVehicleId: vehicle?.id,
    currentPlate: vehicle?.plateNumber,
    currentVin: vehicle?.vin,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    driverName: input.driverName,
    authorizedContactName: input.authorizedContactName,
    lenderName: input.lenderName ?? vehicle?.ownership?.lenderName,
    borrowCost: input.borrowCost,
    notes: input.notes,
    createdBy: ctx.userId,
  })
  await insertTerms({
    contractId: contract.id,
    organizationId,
    version: 1,
    content: input.terms,
    status: 'DRAFT',
    createdBy: ctx.userId,
  })
  await writeHistory(contract, undefined, CONTRACT_STATUSES.DRAFT, 'created', ctx.userId)
  await audit(AUDIT_ACTIONS.CONTRACT_CREATE, contract, ctx.userId, meta, {
    contractNumber,
    type: contract.type,
  })
  return detail(contract)
}

export async function updateDraft(
  ctx: AccessContext,
  id: string,
  input: UpdateContractBody,
  meta: RequestMeta,
): Promise<ContractDetail> {
  assertPermission(ctx, PERMISSIONS.CONTRACT_UPDATE)
  const contract = await loadAccessibleContract(ctx, id)
  if (contract.status !== CONTRACT_STATUSES.DRAFT) {
    throw invalidField('status', 'Only a draft contract can be edited.')
  }
  const type = input.type ?? contract.type
  const customer = await requireCustomer(ctx, input.customerId ?? contract.customerId, contract.organizationId, type)
  const vehicleId = input.vehicleId === null ? undefined : (input.vehicleId ?? contract.currentVehicleId)
  const vehicle = vehicleId
    ? await requireVehicle(ctx, vehicleId, contract.organizationId, type)
    : undefined
  const startsAt = input.startsAt ?? contract.startsAt
  const endsAt = input.endsAt ?? contract.endsAt
  if (endsAt.getTime() <= startsAt.getTime()) throw invalidField('endsAt', 'Return must be after pickup.')
  if (input.terms) {
    const updated = await updateDraftTerms(contract.id, input.terms)
    if (!updated) throw conflict('The signed terms cannot be edited. Add a new version.')
  }
  const saved = await updateDraftContract(contract.id, contract.organizationId, {
    type,
    customerId: customer.id,
    customerSnapshot: snapshotOf(customer),
    legalEntityId: vehicle?.legalEntityId ?? customer.legalEntityId,
    branchId: vehicle?.branchId ?? customer.branchId,
    currentVehicleId: vehicle?.id ?? null,
    currentPlate: vehicle?.plateNumber ?? null,
    currentVin: vehicle?.vin ?? null,
    startsAt,
    endsAt,
    driverName: input.driverName,
    authorizedContactName: input.authorizedContactName,
    lenderName: input.lenderName,
    borrowCost: input.borrowCost,
    notes: input.notes,
  })
  if (!saved) throw conflict('Contract changed in the meantime. Reload and retry.')
  await audit(AUDIT_ACTIONS.CONTRACT_UPDATE, saved, ctx.userId, meta, { contractNumber: saved.contractNumber })
  return detail(saved)
}

async function move(
  ctx: AccessContext,
  id: string,
  to: ContractStatus,
  reason: string,
  meta: RequestMeta,
  patch: Record<string, unknown> = {},
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS] = PERMISSIONS.CONTRACT_UPDATE,
): Promise<ContractRecord> {
  assertPermission(ctx, permission)
  const contract = await loadAccessibleContract(ctx, id)
  if (contract.status === to) return contract
  assertMove(contract.status, to)
  const saved = await transitionContract(contract.id, contract.organizationId, contract.status, to, patch)
  if (!saved) throw conflict('Contract changed in the meantime. Reload and retry.')
  await writeHistory(saved, contract.status, to, reason, ctx.userId)
  return saved
}

export async function submitForApproval(ctx: AccessContext, id: string, meta: RequestMeta) {
  const contract = await loadAccessibleContract(ctx, id)
  const customer = await requireCustomer(ctx, contract.customerId, contract.organizationId, contract.type)
  const saved = await move(ctx, id, CONTRACT_STATUSES.PENDING_APPROVAL, 'submit', meta, {
    customerSnapshot: snapshotOf(customer),
  }, PERMISSIONS.CONTRACT_UPDATE)
  await audit(AUDIT_ACTIONS.CONTRACT_SUBMIT, saved, ctx.userId, meta, { contractNumber: saved.contractNumber })
  return detail(saved)
}

export async function approveContract(ctx: AccessContext, id: string, meta: RequestMeta) {
  const contract = await loadAccessibleContract(ctx, id)
  if (contract.status === CONTRACT_STATUSES.APPROVED) return detail(contract)
  const terms = await latestTerms(contract.id)
  if (terms) await acceptTerms(String(terms._id))
  const saved = await move(ctx, id, CONTRACT_STATUSES.APPROVED, 'approved', meta, {
    approvedBy: ctx.userId,
    approvedAt: new Date(),
    acceptedTermsVersionId: terms ? String(terms._id) : undefined,
  }, PERMISSIONS.CONTRACT_APPROVE)
  await audit(AUDIT_ACTIONS.CONTRACT_APPROVE, saved, ctx.userId, meta, { contractNumber: saved.contractNumber })
  return detail(saved)
}

export async function rejectContract(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  const saved = await move(ctx, id, CONTRACT_STATUSES.CANCELLED, reason, meta, {}, PERMISSIONS.CONTRACT_APPROVE)
  await audit(AUDIT_ACTIONS.CONTRACT_REJECT, saved, ctx.userId, meta, { contractNumber: saved.contractNumber })
  return detail(saved)
}

export async function cancelContract(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  const contract = await loadAccessibleContract(ctx, id)
  if (contract.status === CONTRACT_STATUSES.CANCELLED) return detail(contract)
  const rows = await listAssignmentsForContract(contract.id, contract.organizationId)
  const open = openAssignment(rows)
  if (open && contract.status !== CONTRACT_STATUSES.ACTIVE) {
    await releaseVehicleAssignment(open.vehicleId, open.organizationId, open.id)
  }
  const saved = await move(ctx, id, CONTRACT_STATUSES.CANCELLED, reason, meta, {}, PERMISSIONS.CONTRACT_CANCEL)
  await audit(AUDIT_ACTIONS.CONTRACT_CANCEL, saved, ctx.userId, meta, { contractNumber: saved.contractNumber })
  return detail(saved)
}

async function ensureWindow(
  contract: ContractRecord,
  vehicle: VehicleRecord,
  actorUserId: string,
): Promise<VehicleAssignmentRecord> {
  const rows = await listAssignmentsForContract(contract.id, contract.organizationId)
  const existing = openAssignment(rows)
  if (existing) {
    const others = (
      await findActiveAssignmentsOverlapping(
        existing.vehicleId,
        existing.organizationId,
        contract.startsAt,
        contract.endsAt,
      )
    ).filter((row) => row.id !== existing.id)
    if (others.length > 0) throw conflict('That vehicle is no longer available for this period.')
    return existing
  }
  if (!contract.currentVehicleId) throw invalidField('vehicleId', 'Choose a vehicle before activation.')
  return withVehicleLock(vehicle.id, async () => {
    const current = await findVehicleById(vehicle.id)
    if (!current) throw notFound('Vehicle was not found.')
    if (isNonOperationalStatus(current.status)) {
      throw conflict(`Vehicle is ${toPublicEnum(current.status)} and cannot be assigned.`)
    }
    const overlapping = await findActiveAssignmentsOverlapping(
      current.id,
      current.organizationId,
      contract.startsAt,
      contract.endsAt,
    )
    const decision = decideAssignment(overlapping, { startsAt: contract.startsAt, endsAt: contract.endsAt })
    if (!decision.accepted) throw conflict('That vehicle is no longer available for this period.')
    return insertVehicleAssignment({
      vehicleId: current.id,
      organizationId: current.organizationId,
      branchId: current.branchId,
      startsAt: contract.startsAt,
      endsAt: contract.endsAt,
      reason: `Contract ${contract.contractNumber}`,
      createdBy: actorUserId,
      contractId: contract.id,
      assignmentType: ASSIGNMENT_TYPES.CONTRACT,
      vehiclePlate: current.plateNumber,
    })
  })
}

export async function activateContract(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.CONTRACT_ACTIVATE)
  const contract = await loadAccessibleContract(ctx, id)
  if (contract.status === CONTRACT_STATUSES.ACTIVE) return detail(contract)
  assertMove(contract.status, CONTRACT_STATUSES.ACTIVE)
  if (!contract.acceptedTermsVersionId) throw invalidField('terms', 'Approve the contract terms first.')
  const signed = await findSignedTerms(contract.id, contract.acceptedTermsVersionId)
  if (!signed) throw invalidField('signature', 'The accepted terms must be signed before activation.')
  if (!contract.currentVehicleId) throw invalidField('vehicleId', 'Choose a vehicle before activation.')
  const vehicle = await requireVehicle(ctx, contract.currentVehicleId, contract.organizationId, contract.type)
  const assignment = await ensureWindow(contract, vehicle, ctx.userId)
  const quote = await quoteContractWindow({
    vehicleId: vehicle.id,
    organizationId: contract.organizationId,
    startsAt: contract.startsAt,
    endsAt: contract.endsAt,
    kind: CHARGE_KINDS.RENTAL,
  })
  const borrow = contract.borrowCost
  if (quote) {
    try {
      await insertCharge({
        contractId: contract.id,
        organizationId: contract.organizationId,
        kind: CHARGE_KINDS.RENTAL,
        sourceId: contract.id,
        currency: quote.currency,
        unitAmount: quote.unitAmount,
        quantityDays: quote.quantityDays,
        totalAmount: quote.totalAmount,
        rateType: quote.rateType,
        periodStart: contract.startsAt,
        periodEnd: contract.endsAt,
        createdBy: ctx.userId,
      })
    } catch (error) {
      const code = (error as { code?: number }).code
      if (code !== 11000) throw error
    }
  } else if (borrow) {
    const days = billableDays(contract.startsAt, contract.endsAt)
    try {
      await insertCharge({
        contractId: contract.id,
        organizationId: contract.organizationId,
        kind: CHARGE_KINDS.RENTAL,
        sourceId: contract.id,
        currency: 'PKR',
        unitAmount: borrow,
        quantityDays: days,
        totalAmount: multiplyMoney(borrow, days),
        rateType: 'BORROW',
        periodStart: contract.startsAt,
        periodEnd: contract.endsAt,
        createdBy: ctx.userId,
      })
    } catch (error) {
      const code = (error as { code?: number }).code
      if (code !== 11000) throw error
    }
  }
  const saved = await transitionContract(contract.id, contract.organizationId, CONTRACT_STATUSES.APPROVED, CONTRACT_STATUSES.ACTIVE, {
    originalEndsAt: contract.endsAt,
    activatedAt: new Date(),
    currentPlate: assignment.vehiclePlate ?? vehicle.plateNumber,
    currentVin: vehicle.vin,
    currentVehicleId: vehicle.id,
  })
  if (!saved) {
    const current = await loadAccessibleContract(ctx, id)
    if (current.status === CONTRACT_STATUSES.ACTIVE) return detail(current)
    throw conflict('Contract changed in the meantime. Reload and retry.')
  }
  await writeHistory(saved, CONTRACT_STATUSES.APPROVED, CONTRACT_STATUSES.ACTIVE, 'activated', ctx.userId)
  await audit(AUDIT_ACTIONS.CONTRACT_ACTIVATE, saved, ctx.userId, meta, {
    contractNumber: saved.contractNumber,
    assignmentId: assignment.id,
  })
  return detail(saved)
}

export async function suspendContract(ctx: AccessContext, id: string, meta: RequestMeta) {
  const saved = await move(ctx, id, CONTRACT_STATUSES.SUSPENDED, 'suspended', meta, {}, PERMISSIONS.CONTRACT_UPDATE)
  await audit(AUDIT_ACTIONS.CONTRACT_SUSPEND, saved, ctx.userId, meta, { contractNumber: saved.contractNumber })
  return detail(saved)
}

export async function resumeContract(ctx: AccessContext, id: string, meta: RequestMeta) {
  const saved = await move(ctx, id, CONTRACT_STATUSES.ACTIVE, 'resumed', meta, {}, PERMISSIONS.CONTRACT_ACTIVATE)
  await audit(AUDIT_ACTIONS.CONTRACT_RESUME, saved, ctx.userId, meta, { contractNumber: saved.contractNumber })
  return detail(saved)
}

export async function completeContract(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.CONTRACT_UPDATE)
  const contract = await loadAccessibleContract(ctx, id)
  const vehicleReturn = await findReturn(contract.id)
  if (contract.status === CONTRACT_STATUSES.COMPLETED) {
    const rows = await listAssignmentsForContract(contract.id, contract.organizationId)
    const open = openAssignment(rows)
    if (open) await releaseVehicleAssignment(open.vehicleId, open.organizationId, open.id)
    return detail(contract)
  }
  if (!vehicleReturn) throw invalidField('return', 'Record the vehicle return before completing the contract.')
  const rows = await listAssignmentsForContract(contract.id, contract.organizationId)
  const open = openAssignment(rows)
  const saved = await move(ctx, id, CONTRACT_STATUSES.COMPLETED, 'completed', meta)
  if (open) {
    const returnedAt = new Date(vehicleReturn.occurredAt)
    if (returnedAt > open.startsAt && returnedAt < open.endsAt) {
      await moveAssignmentEnd({
        assignmentId: open.id,
        vehicleId: open.vehicleId,
        organizationId: open.organizationId,
        expectedEndsAt: open.endsAt,
        endsAt: returnedAt,
      })
    }
    await releaseVehicleAssignment(open.vehicleId, open.organizationId, open.id)
  }
  await audit(AUDIT_ACTIONS.CONTRACT_COMPLETE, saved, ctx.userId, meta, { contractNumber: saved.contractNumber })
  return detail(saved)
}

export async function terminateContract(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  const contract = await loadAccessibleContract(ctx, id)
  const rows = await listAssignmentsForContract(contract.id, contract.organizationId)
  const open = openAssignment(rows)
  if (open) await releaseVehicleAssignment(open.vehicleId, open.organizationId, open.id)
  const saved = await move(ctx, id, CONTRACT_STATUSES.TERMINATED, reason, meta, {}, PERMISSIONS.CONTRACT_CANCEL)
  await audit(AUDIT_ACTIONS.CONTRACT_TERMINATE, saved, ctx.userId, meta, { contractNumber: saved.contractNumber })
  return detail(saved)
}

export async function extendContract(ctx: AccessContext, id: string, input: ExtendContractBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.CONTRACT_EXTEND)
  const contract = await loadAccessibleContract(ctx, id)
  if (contract.status !== CONTRACT_STATUSES.ACTIVE) {
    throw invalidField('status', 'Only an active contract can be extended.')
  }
  const rows = await listAssignmentsForContract(contract.id, contract.organizationId)
  const open = openAssignment(rows)
  if (!open) throw conflict('The contract has no open vehicle assignment.')
  const continuity = extensionContinuity(open.endsAt, input.startsAt, input.endsAt)
  if (continuity === 'empty') throw invalidField('endsAt', 'The extension must have a positive length.')
  if (continuity === 'gap') throw invalidField('startsAt', 'The extension must start when the current assignment ends.')
  if (continuity === 'overlap') throw conflict('The extension overlaps the current assignment.')
  const existing = await findExtensionWindow(contract.id, input.startsAt)
  if (existing) return detail(contract)

  const vehicle = await requireVehicle(ctx, open.vehicleId, contract.organizationId, contract.type)
  const quote = await quoteContractWindow({
    vehicleId: vehicle.id,
    organizationId: contract.organizationId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    kind: CHARGE_KINDS.EXTENSION,
  })
  if (!quote) throw conflict('No rate card covers this extension.')

  const extended = await withVehicleLock(vehicle.id, async () => {
    const fresh = (await listAssignmentsForContract(contract.id, contract.organizationId)).find((row) => row.id === open.id)
    if (!fresh || fresh.status !== ASSIGNMENT_STATUSES.ACTIVE) throw conflict('The assignment changed. Reload and retry.')
    if (fresh.endsAt.getTime() !== input.startsAt.getTime()) {
      const again = await findExtensionWindow(contract.id, input.startsAt)
      if (again) return fresh
      throw conflict('The assignment end changed. Reload and retry.')
    }
    const overlapping = (
      await findActiveAssignmentsOverlapping(vehicle.id, vehicle.organizationId, input.startsAt, input.endsAt)
    ).filter((row) => row.id !== fresh.id)
    if (!decideAssignment(overlapping, { startsAt: input.startsAt, endsAt: input.endsAt }).accepted) {
      throw conflict('That vehicle is no longer available for this extension.')
    }
    const moved = await moveAssignmentEnd({
      assignmentId: fresh.id,
      vehicleId: fresh.vehicleId,
      organizationId: fresh.organizationId,
      expectedEndsAt: fresh.endsAt,
      endsAt: input.endsAt,
    })
    if (!moved) throw conflict('The assignment changed. Reload and retry.')
    return moved
  })

  let extensionId = ''
  try {
    const extension = await insertExtension({
      contractId: contract.id,
      organizationId: contract.organizationId,
      assignmentId: extended.id,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      currency: quote.currency,
      unitAmount: quote.unitAmount,
      quantityDays: quote.quantityDays,
      totalAmount: quote.totalAmount,
      rateType: quote.rateType,
      createdBy: ctx.userId,
    })
    extensionId = String(extension._id)
    await insertCharge({
      contractId: contract.id,
      organizationId: contract.organizationId,
      kind: CHARGE_KINDS.EXTENSION,
      sourceId: extensionId,
      currency: quote.currency,
      unitAmount: quote.unitAmount,
      quantityDays: quote.quantityDays,
      totalAmount: quote.totalAmount,
      rateType: quote.rateType,
      periodStart: input.startsAt,
      periodEnd: input.endsAt,
      createdBy: ctx.userId,
    })
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 11000) throw error
  }
  const saved = await transitionContract(contract.id, contract.organizationId, CONTRACT_STATUSES.ACTIVE, CONTRACT_STATUSES.ACTIVE, {
    endsAt: input.endsAt,
  })
  await audit(AUDIT_ACTIONS.CONTRACT_EXTEND, saved ?? contract, ctx.userId, meta, {
    contractNumber: contract.contractNumber,
    extensionId,
    startsAt: input.startsAt.toISOString(),
    endsAt: input.endsAt.toISOString(),
  })
  return detail(saved ?? contract)
}

export async function amendPricing(ctx: AccessContext, id: string, input: AmendPricingBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.CONTRACT_AMEND_PRICING)
  const contract = await loadAccessibleContract(ctx, id)
  if (contract.status !== CONTRACT_STATUSES.ACTIVE && contract.status !== CONTRACT_STATUSES.APPROVED) {
    throw invalidField('status', 'Pricing can be amended on an approved or active contract.')
  }
  const charges = await listCharges(contract.id)
  const current = [...charges].reverse().find((charge) => !charge.supersededBy && charge.kind !== 'EXTENSION')
  if (!current) throw conflict('There is no pricing row to amend.')
  const days = Number(current.quantityDays)
  const newTotal = multiplyMoney(input.unitAmount, days)
  const amendment = await insertAmendment({
    contractId: contract.id,
    organizationId: contract.organizationId,
    previousChargeId: String(current._id),
    previousTotal: String(current.totalAmount),
    newUnitAmount: input.unitAmount,
    newTotal,
    currency: String(current.currency),
    quantityDays: days,
    reason: input.reason,
    effectiveAt: input.effectiveAt,
    createdBy: ctx.userId,
  })
  const amendmentId = String(amendment._id)
  await insertCharge({
    contractId: contract.id,
    organizationId: contract.organizationId,
    kind: CHARGE_KINDS.AMENDMENT,
    sourceId: amendmentId,
    currency: String(current.currency),
    unitAmount: input.unitAmount,
    quantityDays: days,
    totalAmount: newTotal,
    rateType: String(current.rateType),
    periodStart: new Date(current.periodStart),
    periodEnd: new Date(current.periodEnd),
    createdBy: ctx.userId,
  })
  await supersedeCharge(String(current._id), amendmentId)
  await audit(AUDIT_ACTIONS.CONTRACT_AMEND, contract, ctx.userId, meta, {
    contractNumber: contract.contractNumber,
    amendmentId,
  })
  return detail(contract)
}

export async function replaceVehicle(ctx: AccessContext, id: string, input: ReplaceVehicleBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.CONTRACT_REPLACE_VEHICLE)
  const contract = await loadAccessibleContract(ctx, id)
  if (contract.status !== CONTRACT_STATUSES.ACTIVE) {
    throw invalidField('status', 'Only an active contract can replace a vehicle.')
  }
  const already = await findReplacementAt(contract.id, input.occurredAt, input.vehicleId)
  if (already) return detail(contract)
  const rows = await listAssignmentsForContract(contract.id, contract.organizationId)
  const open = openAssignment(rows)
  if (!open) throw conflict('The contract has no open vehicle assignment.')
  if (input.occurredAt <= open.startsAt || input.occurredAt >= open.endsAt) {
    throw invalidField('occurredAt', 'The replacement must fall inside the open assignment.')
  }
  const next = await requireVehicle(ctx, input.vehicleId, contract.organizationId, contract.type)
  if (next.id === open.vehicleId) throw invalidField('vehicleId', 'Choose a different vehicle.')

  const created = await withVehicleLock(next.id, async () => {
    const current = await findVehicleById(next.id)
    if (!current || isNonOperationalStatus(current.status)) {
      throw conflict('The replacement vehicle is not available.')
    }
    const overlapping = await findActiveAssignmentsOverlapping(
      current.id,
      current.organizationId,
      input.occurredAt,
      open.endsAt,
    )
    if (!decideAssignment(overlapping, { startsAt: input.occurredAt, endsAt: open.endsAt }).accepted) {
      throw conflict('The replacement vehicle is not available for this period.')
    }
    return insertVehicleAssignment({
      vehicleId: current.id,
      organizationId: current.organizationId,
      branchId: current.branchId,
      startsAt: input.occurredAt,
      endsAt: open.endsAt,
      reason: `Replacement on ${contract.contractNumber}`,
      createdBy: ctx.userId,
      contractId: contract.id,
      assignmentType: ASSIGNMENT_TYPES.REPLACEMENT,
      sourceAssignmentId: open.id,
      vehiclePlate: current.plateNumber,
    })
  })

  const closed = await moveAssignmentEnd({
    assignmentId: open.id,
    vehicleId: open.vehicleId,
    organizationId: open.organizationId,
    expectedEndsAt: open.endsAt,
    endsAt: input.occurredAt,
  })
  if (!closed) {
    await releaseVehicleAssignment(created.vehicleId, created.organizationId, created.id)
    throw conflict('The current assignment changed. The replacement was not applied.')
  }

  await insertReplacement({
    contractId: contract.id,
    organizationId: contract.organizationId,
    previousVehicleId: open.vehicleId,
    replacementVehicleId: next.id,
    previousAssignmentId: open.id,
    replacementAssignmentId: created.id,
    previousPlate: open.vehiclePlate ?? contract.currentPlate ?? '',
    replacementPlate: next.plateNumber,
    reason: input.reason,
    notes: input.notes,
    status: REPLACEMENT_STATUSES.COMPLETED,
    occurredAt: input.occurredAt,
    requestedBy: ctx.userId,
    approvedBy: ctx.userId,
  })
  const saved = await transitionContract(contract.id, contract.organizationId, CONTRACT_STATUSES.ACTIVE, CONTRACT_STATUSES.ACTIVE, {
    currentVehicleId: next.id,
    currentPlate: next.plateNumber,
    currentVin: next.vin,
  })
  await audit(AUDIT_ACTIONS.CONTRACT_REPLACE, saved ?? contract, ctx.userId, meta, {
    contractNumber: contract.contractNumber,
    previousVehicleId: open.vehicleId,
    replacementVehicleId: next.id,
    previousAssignmentId: open.id,
    replacementAssignmentId: created.id,
  })
  return detail(saved ?? contract)
}

async function inspection(
  ctx: AccessContext,
  id: string,
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
) {
  assertPermission(ctx, permission)
  const contract = await loadAccessibleContract(ctx, id)
  if (contract.status !== CONTRACT_STATUSES.ACTIVE && contract.status !== CONTRACT_STATUSES.SUSPENDED) {
    throw invalidField('status', 'Handover and return apply to an active contract.')
  }
  const rows = await listAssignmentsForContract(contract.id, contract.organizationId)
  const open = openAssignment(rows)
  if (!open) throw conflict('The contract has no open vehicle assignment.')
  return { contract, open }
}

export async function recordHandover(ctx: AccessContext, id: string, input: HandoverBody, meta: RequestMeta) {
  const { contract, open } = await inspection(ctx, id, PERMISSIONS.CONTRACT_HANDOVER)
  const existing = await findHandover(contract.id)
  if (existing) return detail(contract)
  await insertHandover({
    contractId: contract.id,
    organizationId: contract.organizationId,
    assignmentId: open.id,
    occurredAt: input.occurredAt,
    mileageKm: input.mileageKm,
    fuelPercent: input.fuelPercent,
    condition: input.condition,
    notes: input.notes,
    acknowledged: input.acknowledged,
    staffUserId: ctx.userId,
  })
  await audit(AUDIT_ACTIONS.CONTRACT_HANDOVER, contract, ctx.userId, meta, { contractNumber: contract.contractNumber })
  return detail(contract)
}

export async function recordReturn(ctx: AccessContext, id: string, input: ReturnBody, meta: RequestMeta) {
  const { contract, open } = await inspection(ctx, id, PERMISSIONS.CONTRACT_RETURN)
  const existing = await findReturn(contract.id)
  if (existing) return detail(contract)
  const handover = await findHandover(contract.id)
  if (!handover) throw invalidField('handover', 'Hand the vehicle over before recording the return.')
  if (input.occurredAt < new Date(handover.occurredAt)) {
    throw invalidField('occurredAt', 'Return cannot be before handover.')
  }
  if (input.mileageKm < Number(handover.mileageKm)) {
    throw invalidField('mileageKm', 'Return mileage cannot be less than the handover mileage.')
  }
  await insertReturn({
    contractId: contract.id,
    organizationId: contract.organizationId,
    assignmentId: open.id,
    occurredAt: input.occurredAt,
    mileageKm: input.mileageKm,
    fuelPercent: input.fuelPercent,
    condition: input.condition,
    damageNotes: input.damageNotes,
    notes: input.notes,
    acknowledged: input.acknowledged,
    staffUserId: ctx.userId,
  })
  await audit(AUDIT_ACTIONS.CONTRACT_RETURN, contract, ctx.userId, meta, { contractNumber: contract.contractNumber })
  return detail(contract)
}

export async function addTerms(ctx: AccessContext, id: string, content: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.CONTRACT_UPDATE)
  const contract = await loadAccessibleContract(ctx, id)
  if (
    contract.status === CONTRACT_STATUSES.COMPLETED ||
    contract.status === CONTRACT_STATUSES.CANCELLED ||
    contract.status === CONTRACT_STATUSES.TERMINATED
  ) {
    throw invalidField('status', 'Terms cannot be added to a closed contract.')
  }
  const latest = await latestTerms(contract.id)
  const version = latest ? Number(latest.version) + 1 : 1
  await insertTerms({
    contractId: contract.id,
    organizationId: contract.organizationId,
    version,
    content,
    status: 'DRAFT',
    createdBy: ctx.userId,
  })
  await audit(AUDIT_ACTIONS.CONTRACT_TERMS, contract, ctx.userId, meta, {
    contractNumber: contract.contractNumber,
    version,
  })
  return detail(contract)
}

export async function signContract(ctx: AccessContext, id: string, input: SignatureBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.CONTRACT_UPDATE)
  const contract = await loadAccessibleContract(ctx, id)
  const terms = await latestTerms(contract.id)
  if (!terms) throw invalidField('terms', 'Add contract terms before signing.')
  const termsId = String(terms._id)
  const existing = await findSignedTerms(contract.id, termsId)
  if (existing && existing.signerName === input.signerName) return detail(contract)
  if (terms.status === 'DRAFT') await acceptTerms(termsId)
  try {
    await insertSignature({
      contractId: contract.id,
      organizationId: contract.organizationId,
      termsVersionId: termsId,
      signerName: input.signerName,
      status: SIGNATURE_STATUSES.SIGNED,
      provider: input.provider ?? 'internal',
      signedAt: new Date(),
    })
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 11000) throw error
  }
  if (contract.acceptedTermsVersionId !== termsId) {
    await transitionContract(contract.id, contract.organizationId, contract.status, contract.status, {
      acceptedTermsVersionId: termsId,
    })
  }
  await audit(AUDIT_ACTIONS.CONTRACT_SIGN, contract, ctx.userId, meta, {
    contractNumber: contract.contractNumber,
    termsVersionId: termsId,
    provider: input.provider ?? 'internal',
  })
  const fresh = await loadAccessibleContract(ctx, id)
  return detail(fresh)
}

export async function applySignatureCallback(ctx: AccessContext, input: SignatureCallbackBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.CONTRACT_UPDATE)
  const contract = await loadAccessibleContract(ctx, input.contractId)
  const duplicate = await findSignatureByEvent(contract.organizationId, input.externalEventId)
  if (duplicate) {
    await audit(AUDIT_ACTIONS.CONTRACT_SIGNATURE_DUPLICATE, contract, ctx.userId, meta, {
      externalEventId: input.externalEventId,
    })
    return { contract: await detail(contract), duplicate: true }
  }
  try {
    await insertSignature({
      contractId: contract.id,
      organizationId: contract.organizationId,
      termsVersionId: input.termsVersionId,
      signerName: input.signerName,
      status: input.status,
      provider: input.provider,
      signedAt: input.status === SIGNATURE_STATUSES.SIGNED ? new Date() : undefined,
      externalEventId: input.externalEventId,
    })
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 11000) throw error
    return { contract: await detail(contract), duplicate: true }
  }
  if (input.status === SIGNATURE_STATUSES.SIGNED) {
    await transitionContract(contract.id, contract.organizationId, contract.status, contract.status, {
      acceptedTermsVersionId: input.termsVersionId,
    })
  }
  await audit(AUDIT_ACTIONS.CONTRACT_SIGN, contract, ctx.userId, meta, {
    contractNumber: contract.contractNumber,
    externalEventId: input.externalEventId,
    provider: input.provider,
  })
  return { contract: await detail(await loadAccessibleContract(ctx, contract.id)), duplicate: false }
}

export async function convertBookingToContract(ctx: AccessContext, bookingId: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.BOOKING_CONVERT)
  assertPermission(ctx, PERMISSIONS.CONTRACT_CREATE)
  const booking = await loadAccessibleBooking(ctx, bookingId)
  const key = `booking:${booking.id}`
  const existing = await findContractByBookingId(booking.id)
  if (existing) {
    if (!canAccessContract(ctx, existing)) throw notFound('Contract was not found.')
    return detail(existing)
  }
  const claim = await claimContractKey(booking.organizationId, key, hashContractRequest({ bookingId: booking.id }))
  if (claim === 'replay') {
    const id = await contractIdForKey(booking.organizationId, key)
    if (id) return detail(await loadAccessibleContract(ctx, id))
  }
  if (claim === 'mismatch') throw conflict('This booking conversion was already used with a different request.')
  if (claim === 'busy') throw conflict('This conversion is already in progress. Retry.')

  try {
    const again = await findContractByBookingId(booking.id)
    if (again) {
      await attachContractKey(booking.organizationId, key, again.id)
      return detail(again)
    }
    if (booking.status !== BOOKING_STATUSES.CONFIRMED && booking.status !== BOOKING_STATUSES.CONVERTED) {
      throw invalidField('status', 'Only a confirmed booking can become a contract.')
    }
    if (!booking.vehicleId) throw invalidField('vehicleId', 'The booking has no vehicle.')
    // Resolve type from the customer first. Passing B2C here would reject a corporate booking.
    const customerProbe = await findCustomerById(booking.customerId)
    if (
      !customerProbe ||
      customerProbe.organizationId !== booking.organizationId ||
      !canAccessCustomer(ctx, customerProbe)
    ) {
      throw notFound('Customer was not found.')
    }
    const type =
      customerProbe.type === CUSTOMER_TYPES.CORPORATE ? CONTRACT_TYPES.B2B : CONTRACT_TYPES.B2C
    const customer = await requireCustomer(ctx, booking.customerId, booking.organizationId, type)
    const vehicle = await requireVehicle(ctx, booking.vehicleId, booking.organizationId, type)
    const contractNumber = await allocateContractNumber(booking.organizationId)
    const contract = await insertContract({
      organizationId: booking.organizationId,
      legalEntityId: booking.legalEntityId,
      branchId: booking.branchId,
      contractNumber,
      type,
      status: CONTRACT_STATUSES.APPROVED,
      customerId: customer.id,
      customerSnapshot: snapshotOf(customer),
      bookingId: booking.id,
      currentVehicleId: vehicle.id,
      currentPlate: vehicle.plateNumber,
      currentVin: vehicle.vin,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      createdBy: ctx.userId,
    })
    const terms = await insertTerms({
      contractId: contract.id,
      organizationId: contract.organizationId,
      version: 1,
      content: `Terms carried from booking ${booking.bookingNumber}.`,
      status: 'ACCEPTED',
      createdBy: ctx.userId,
      effectiveAt: new Date(),
    })
    await transitionContract(contract.id, contract.organizationId, CONTRACT_STATUSES.APPROVED, CONTRACT_STATUSES.APPROVED, {
      acceptedTermsVersionId: String(terms._id),
      approvedBy: ctx.userId,
      approvedAt: new Date(),
    })
    if (booking.assignmentId) {
      const linked = await linkAssignmentToContract(booking.assignmentId, booking.organizationId, contract.id)
      if (!linked) throw conflict('The booking assignment could not be linked. No second assignment was created.')
    }
    if (booking.pricing) {
      await insertCharge({
        contractId: contract.id,
        organizationId: contract.organizationId,
        kind: CHARGE_KINDS.RENTAL,
        sourceId: contract.id,
        currency: booking.pricing.currency,
        unitAmount: booking.pricing.unitAmount,
        quantityDays: booking.pricing.quantityDays,
        totalAmount: booking.pricing.totalAmount,
        rateType: booking.pricing.rateType,
        periodStart: booking.startsAt,
        periodEnd: booking.endsAt,
        createdBy: ctx.userId,
      })
    }
    if (booking.status === BOOKING_STATUSES.CONFIRMED) {
      await transitionBooking(booking.id, booking.organizationId, BOOKING_STATUSES.CONFIRMED, BOOKING_STATUSES.CONVERTED, {
        conversionKey: key,
      })
    }
    await attachContractKey(contract.organizationId, key, contract.id)
    await writeHistory(contract, undefined, CONTRACT_STATUSES.APPROVED, 'booking', ctx.userId)
    await audit(AUDIT_ACTIONS.CONTRACT_CONVERT, contract, ctx.userId, meta, {
      contractNumber,
      bookingId: booking.id,
    })
    return detail(await loadAccessibleContract(ctx, contract.id))
  } catch (error) {
    await releaseContractKey(booking.organizationId, key)
    throw error
  }
}

export function billableOf(charges: { id: string; kind: string; sourceId: string; supersededBy?: string }[]) {
  return selectBillableCharges(charges)
}
