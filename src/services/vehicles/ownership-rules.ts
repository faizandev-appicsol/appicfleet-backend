import { OWNERSHIP_TYPES, type OwnershipType } from '../../constants/vehicles.js'
import { AppError } from '../../exceptions/AppError.js'
import { ERROR_CODES } from '../../exceptions/errorCodes.js'
import type { IVehicleOwnership } from '../../interfaces/vehicle.interface.js'

type OwnershipField = keyof IVehicleOwnership

/** Which ownership fields belong to which ownership type. */
export const OWNERSHIP_FIELDS: Readonly<Record<OwnershipType, readonly OwnershipField[]>> = {
  [OWNERSHIP_TYPES.COMPANY]: [],
  [OWNERSHIP_TYPES.INVESTOR]: ['investorName', 'investorReference'],
  [OWNERSHIP_TYPES.BORROWED]: ['lenderName', 'expectedReturnOn'],
  [OWNERSHIP_TYPES.LEASED]: [
    'lessorName',
    'leaseStartsOn',
    'leaseEndsOn',
    'leaseAmount',
    'leaseCurrency',
    'purchasePrice',
    'downPayment',
    'financedAmount',
    'interestRate',
    'numberOfInstallments',
  ],
}

const REQUIRED_FIELDS: Readonly<Record<OwnershipType, readonly OwnershipField[]>> = {
  [OWNERSHIP_TYPES.COMPANY]: [],
  [OWNERSHIP_TYPES.INVESTOR]: ['investorName'],
  [OWNERSHIP_TYPES.BORROWED]: ['lenderName'],
  [OWNERSHIP_TYPES.LEASED]: ['lessorName'],
}

const ALL_FIELDS: readonly OwnershipField[] = [
  'investorName',
  'investorReference',
  'lenderName',
  'expectedReturnOn',
  'lessorName',
  'leaseStartsOn',
  'leaseEndsOn',
  'leaseAmount',
  'leaseCurrency',
  'purchasePrice',
  'downPayment',
  'financedAmount',
  'interestRate',
  'numberOfInstallments',
]

/**
 * Pure ownership check. Returns field -> message (empty when valid):
 * - fields that do not belong to the ownership type are rejected;
 * - the identifying party (investor / lender / lessor) is required;
 * - a lease needs its end after its start, and an amount needs a currency (and vice versa).
 */
export function validateOwnership(
  type: OwnershipType,
  ownership: IVehicleOwnership | undefined,
): Record<string, string> {
  const errors: Record<string, string> = {}
  const allowed = OWNERSHIP_FIELDS[type]
  const value: IVehicleOwnership = ownership ?? {}

  for (const field of ALL_FIELDS) {
    if (value[field] !== undefined && !allowed.includes(field)) {
      errors[field] = `Not used for ${type.toLowerCase()} ownership`
    }
  }
  for (const field of REQUIRED_FIELDS[type]) {
    if (value[field] === undefined) errors[field] = 'This field is required'
  }

  if (type === OWNERSHIP_TYPES.LEASED) {
    if (
      value.leaseStartsOn &&
      value.leaseEndsOn &&
      value.leaseEndsOn.getTime() <= value.leaseStartsOn.getTime()
    ) {
      errors.leaseEndsOn = 'Lease end must be after lease start'
    }
    if (value.leaseAmount !== undefined && value.leaseCurrency === undefined) {
      errors.leaseCurrency = 'Provide the currency for the lease amount'
    }
    if (value.leaseCurrency !== undefined && value.leaseAmount === undefined) {
      errors.leaseAmount = 'Provide the lease amount for the currency'
    }
  }
  return errors
}

/** Throws 422 with `ownership.<field>` field errors. */
export function assertOwnership(type: OwnershipType, ownership: IVehicleOwnership | undefined): void {
  const errors = validateOwnership(type, ownership)
  const entries = Object.entries(errors)
  if (entries.length === 0) return
  throw new AppError('Some fields need to be corrected.', 422, ERROR_CODES.VALIDATION_ERROR, {
    fieldErrors: Object.fromEntries(entries.map(([field, message]) => [`ownership.${field}`, [message]])),
  })
}

/** Keeps only the fields that belong to the type (defensive; validation already rejects extras). */
export function pickOwnership(
  type: OwnershipType,
  ownership: IVehicleOwnership | undefined,
): IVehicleOwnership | undefined {
  if (!ownership || type === OWNERSHIP_TYPES.COMPANY) return undefined
  const picked: IVehicleOwnership = {}
  for (const field of OWNERSHIP_FIELDS[type]) {
    const entry = ownership[field]
    if (entry !== undefined) Object.assign(picked, { [field]: entry })
  }
  return Object.keys(picked).length > 0 ? picked : undefined
}
