import { CONTRACT_STATUSES, CONTRACT_TYPES, type ContractStatus, type ContractType } from '../../constants/contracts.js'
import { CUSTOMER_TYPES, type CustomerType } from '../../constants/customers.js'
import { intervalsOverlap, type Interval } from '../vehicles/intervals.js'

const S = CONTRACT_STATUSES

/** Draft B2C and Draft B2B are a type plus DRAFT, not separate models. */
export const CONTRACT_TRANSITIONS: Readonly<Record<ContractStatus, readonly ContractStatus[]>> = {
  [S.DRAFT]: [S.PENDING_APPROVAL, S.CANCELLED],
  [S.PENDING_APPROVAL]: [S.APPROVED, S.CANCELLED],
  [S.APPROVED]: [S.ACTIVE, S.CANCELLED],
  [S.ACTIVE]: [S.SUSPENDED, S.COMPLETED, S.TERMINATED],
  [S.SUSPENDED]: [S.ACTIVE, S.TERMINATED],
  [S.COMPLETED]: [],
  [S.CANCELLED]: [],
  [S.TERMINATED]: [],
}

export function canTransition(from: ContractStatus, to: ContractStatus): boolean {
  return CONTRACT_TRANSITIONS[from].includes(to)
}

/** B2C is an individual. B2B is a company. Borrow may use either; the vehicle must be borrowed. */
export function requiredCustomerType(type: ContractType): CustomerType | undefined {
  if (type === CONTRACT_TYPES.B2C) return CUSTOMER_TYPES.INDIVIDUAL
  if (type === CONTRACT_TYPES.B2B) return CUSTOMER_TYPES.CORPORATE
  return undefined
}

export function isDraftType(type: ContractType, status: ContractStatus): boolean {
  return status === S.DRAFT && (type === CONTRACT_TYPES.B2C || type === CONTRACT_TYPES.B2B)
}

/** Next slice must start where the current window ends. A later start is a gap. An earlier start overlaps. */
export function extensionContinuity(
  currentEnd: Date,
  extensionStart: Date,
  extensionEnd: Date,
): 'ok' | 'gap' | 'overlap' | 'empty' {
  if (extensionEnd.getTime() <= extensionStart.getTime()) return 'empty'
  if (extensionStart.getTime() === currentEnd.getTime()) return 'ok'
  if (extensionStart.getTime() > currentEnd.getTime()) return 'gap'
  return 'overlap'
}

export function assignmentsOverlap(a: Interval, b: Interval): boolean {
  return intervalsOverlap(a, b)
}

export type ChargeView = {
  id: string
  kind: string
  sourceId: string
  /** When set, this row is history. The amendment it points at is what a future invoice bills. */
  supersededBy?: string
}

/**
 * Original rental stays in storage after an amendment, but it is not billed twice.
 * Extensions each contribute once. Replacements are not charges.
 */
export function selectBillableCharges(charges: readonly ChargeView[]): ChargeView[] {
  return charges.filter((charge) => !charge.supersededBy && charge.kind !== 'REPLACEMENT')
}

export type ReplacementWindow = {
  id: string
  contractId: string
  vehicleId: string
  startsAt: number
  endsAt: number
}

/**
 * Splits one window at `at` without changing the old row's vehicle.
 * The contract id is copied onto the new window and is not replaced.
 */
export function projectReplacement(input: {
  contractId: string
  customerId: string
  termsVersionId?: string
  old: ReplacementWindow
  replacementVehicleId: string
  at: number
  available: boolean
}):
  | {
      ok: true
      contractId: string
      customerId: string
      termsVersionId?: string
      assignments: ReplacementWindow[]
    }
  | { ok: false; reason: string } {
  if (!input.available) return { ok: false, reason: 'unavailable' }
  if (input.replacementVehicleId === input.old.vehicleId) return { ok: false, reason: 'same_vehicle' }
  if (input.at <= input.old.startsAt || input.at >= input.old.endsAt) return { ok: false, reason: 'outside' }
  const closed: ReplacementWindow = { ...input.old, endsAt: input.at }
  const opened: ReplacementWindow = {
    id: 'next',
    contractId: input.contractId,
    vehicleId: input.replacementVehicleId,
    startsAt: input.at,
    endsAt: input.old.endsAt,
  }
  if (assignmentsOverlap(
    { starts: new Date(closed.startsAt), ends: new Date(closed.endsAt) },
    { starts: new Date(opened.startsAt), ends: new Date(opened.endsAt) },
  )) {
    return { ok: false, reason: 'overlap' }
  }
  return {
    ok: true,
    contractId: input.contractId,
    customerId: input.customerId,
    termsVersionId: input.termsVersionId,
    assignments: [closed, opened],
  }
}

export function decideConversion(existingContractId: string | undefined): 'replay' | 'create' {
  return existingContractId ? 'replay' : 'create'
}

/** Copies the fields a contract freezes. Later edits to the source object are not visible here. */
export function freezeSnapshot<T extends Record<string, unknown>>(source: T): T {
  return structuredClone(source)
}
