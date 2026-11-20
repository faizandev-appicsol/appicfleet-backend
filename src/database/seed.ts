import type { Types } from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { env } from '../config/env.js'
import {
  ENTITY_STATUSES,
  ROLES,
  SYSTEM_ROLE_DEFINITIONS,
  USER_STATUSES,
  type Role,
} from '../constants/roles.js'
import {
  CONTACT_ROLES,
  CONTACT_STATUSES,
  CUSTOMER_DOCUMENT_STATUSES,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  DUPLICATE_REVIEW_STATUSES,
  DUPLICATE_SIGNALS,
  type CustomerType,
} from '../constants/customers.js'
import type { ICustomerCorporate, ICustomerIndividual } from '../interfaces/customer.interface.js'
import { logger } from '../lib/logger/index.js'
import { hashPassword } from '../lib/password/index.js'
import { Branch } from '../models/branch.model.js'
import { LegalEntity } from '../models/legal-entity.model.js'
import {
  ASSIGNMENT_STATUSES,
  OWNERSHIP_TYPES,
  RATE_STATUSES,
  RATE_TYPES,
  VEHICLE_CATEGORIES,
  VEHICLE_FUEL_TYPES,
  VEHICLE_STATUSES,
  VEHICLE_TRANSMISSIONS,
  type OwnershipType,
  type VehicleCategory,
  type VehicleFuelType,
  type VehicleStatus,
  type VehicleTransmission,
} from '../constants/vehicles.js'
import type { IVehicleCompliance, IVehicleOwnership } from '../interfaces/vehicle.interface.js'
import { CustomerContact } from '../models/customer-contact.model.js'
import { CustomerDuplicateReview } from '../models/customer-duplicate-review.model.js'
import { Customer } from '../models/customer.model.js'
import { BOOKING_SOURCES, BOOKING_STATUSES } from '../constants/bookings.js'
import { Booking } from '../models/booking.model.js'
import {
  Contract,
  ContractCharge,
  ContractExtension,
  ContractHandover,
  ContractReturn,
  ContractSignature,
  ContractStatusEvent,
  ContractTermsVersion,
} from '../models/contract.model.js'
import { BookingStatusEvent } from '../models/booking-status-event.model.js'
import { Organization } from '../models/organization.model.js'
import { Role as RoleModel } from '../models/role.model.js'
import { User } from '../models/user.model.js'
import { VehicleAssignment } from '../models/vehicle-assignment.model.js'
import { VehicleRateCard } from '../models/vehicle-rate-card.model.js'
import { Vehicle } from '../models/vehicle.model.js'
import {
  CreditNote,
  DebitNote,
  Deposit,
  Invoice,
  InvoiceLine,
  Payment,
  PaymentAllocation,
  Receipt,
} from '../models/finance.model.js'
import { normalizeEmail, normalizePhone } from '../services/customers/customer-rules.js'
import { evaluateCompliance } from '../services/vehicles/compliance.js'

/**
 * Development seed. Idempotent: every record is looked up first and created only when missing;
 * existing accounts are never overwritten (passwords are never reset).
 *
 * Always (when SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are set):
 *   - system roles with their default permissions
 *   - Organization A (ORG-A) with one legal entity, and the env admin as its ORG_ADMIN
 *     (an existing env admin without a tenant is attached to Organization A)
 *
 * Demo data, skipped when NODE_ENV=production:
 *   - Org A branches A1 and A2
 *   - Org A demo vehicles DEV-A1-001..DEV-A2-004 (created only when the plate is missing; PKR amounts)
 *   - Org A demo customers CUS-DEV-001 (individual, A1, one contact) and CUS-DEV-002 (corporate, A2)
 *     sharing a phone number, with one POTENTIAL duplicate review (fake values only)
 *   - Organization B (ORG-B) with legal entity and branch B1
 *   - DEV-ONLY accounts below. They all share the password in DEV_PASSWORD.
 *
 *     super.admin@dev.appic.test   SUPER_ADMIN, platform-wide
 *     manager.a1@dev.appic.test    BRANCH_MANAGER of Org A, branch A1 only
 *     admin.b@dev.appic.test       ORG_ADMIN of Org B
 *
 * DEV_PASSWORD is a public, well-known value. NEVER use these accounts outside local development.
 */
const DEV_PASSWORD = 'DevOnly!ChangeMe1'

const DEV_EMAILS = {
  superAdmin: 'super.admin@dev.appic.test',
  branchManagerA1: 'manager.a1@dev.appic.test',
  adminB: 'admin.b@dev.appic.test',
} as const

type Id = Types.ObjectId

async function seedSystemRoles(): Promise<void> {
  for (const definition of SYSTEM_ROLE_DEFINITIONS) {
    await RoleModel.updateOne(
      { organizationId: null, code: definition.code },
      {
        $set: {
          name: definition.name,
          description: definition.description,
          permissionKeys: [...definition.permissionKeys],
          isSystem: true,
          status: ENTITY_STATUSES.ACTIVE,
        },
      },
      { upsert: true },
    )
  }
}

async function ensureOrganization(code: string, name: string): Promise<Id> {
  const existing = await Organization.findOne({ code }).select('_id').lean()
  if (existing) return existing._id
  const created = await Organization.create({ code, name, status: ENTITY_STATUSES.ACTIVE })
  return created._id
}

async function ensureLegalEntity(
  organizationId: Id,
  legalName: string,
  displayName: string,
): Promise<Id> {
  const existing = await LegalEntity.findOne({ organizationId, legalName }).select('_id').lean()
  if (existing) return existing._id
  const created = await LegalEntity.create({
    organizationId,
    legalName,
    displayName,
    country: 'PK',
    defaultCurrency: 'PKR',
    timezone: 'Asia/Karachi',
    status: ENTITY_STATUSES.ACTIVE,
  })
  return created._id
}

async function ensureBranch(
  organizationId: Id,
  legalEntityId: Id,
  code: string,
  name: string,
): Promise<Id> {
  const existing = await Branch.findOne({ organizationId, code }).select('_id').lean()
  if (existing) return existing._id
  const created = await Branch.create({
    organizationId,
    legalEntityId,
    code,
    name,
    timezone: 'Asia/Karachi',
    status: ENTITY_STATUSES.ACTIVE,
  })
  return created._id
}

type SeedUser = {
  email: string
  name: string
  password: string
  role: Role
  organizationId: Id | null
  legalEntityIds?: Id[]
  branchIds?: Id[]
  accessAllBranches?: boolean
  accessAllOrganizations?: boolean
}

async function ensureUser(input: SeedUser): Promise<void> {
  const existing = await User.findOne({ email: input.email }).select('_id organizationId')
  if (existing) {
    // Attach pre-Module-3 accounts to a tenant; never touch credentials or other fields.
    if (!existing.organizationId && input.organizationId && !input.accessAllOrganizations) {
      await User.updateOne(
        { _id: existing._id },
        {
          $set: {
            organizationId: input.organizationId,
            legalEntityIds: input.legalEntityIds ?? [],
            branchIds: input.branchIds ?? [],
            accessAllBranches: input.accessAllBranches ?? false,
          },
        },
      )
    }
    return
  }

  await User.create({
    email: input.email,
    name: input.name,
    passwordHash: await hashPassword(input.password),
    role: input.role,
    status: USER_STATUSES.ACTIVE,
    organizationId: input.organizationId,
    legalEntityIds: input.legalEntityIds ?? [],
    branchIds: input.branchIds ?? [],
    accessAllBranches: input.accessAllBranches ?? false,
    accessAllOrganizations: input.accessAllOrganizations ?? false,
  })
}

const DAY_MS = 24 * 60 * 60 * 1000

/** UTC-midnight calendar date `days` from today (negative = in the past). */
function utcDateFromToday(days: number): Date {
  const today = Math.floor(Date.now() / DAY_MS) * DAY_MS
  return new Date(today + days * DAY_MS)
}

type SeedVehicle = {
  plateNumber: string
  branchId: Id
  make: string
  model: string
  year: number
  category: VehicleCategory
  transmission: VehicleTransmission
  fuelType: VehicleFuelType
  seatingCapacity: number
  mileageKm: number
  ownershipType: OwnershipType
  ownership?: IVehicleOwnership
  status: VehicleStatus
  compliance: IVehicleCompliance
}

/** Creates the vehicle only when the plate is not present in the organization. */
async function ensureVehicle(
  organizationId: Id,
  legalEntityId: Id,
  createdBy: Id,
  input: SeedVehicle,
): Promise<Id> {
  const existing = await Vehicle.findOne({ organizationId, plateNumber: input.plateNumber })
    .select('_id')
    .lean()
  if (existing) return existing._id

  const created = await Vehicle.create({
    ...input,
    organizationId,
    legalEntityId,
    createdBy,
    complianceState: evaluateCompliance(input.compliance, new Date()).overall,
  })
  return created._id
}

async function ensureDailyRate(
  organizationId: Id,
  vehicleId: Id,
  createdBy: Id,
  amount: string,
): Promise<void> {
  const existing = await VehicleRateCard.exists({
    vehicleId,
    rateType: RATE_TYPES.DAILY,
    status: RATE_STATUSES.ACTIVE,
  })
  if (existing) return
  await VehicleRateCard.create({
    vehicleId,
    organizationId,
    rateType: RATE_TYPES.DAILY,
    amount,
    currency: 'PKR',
    effectiveFrom: utcDateFromToday(-30),
    effectiveTo: null,
    status: RATE_STATUSES.ACTIVE,
    createdBy,
  })
}

async function ensureActiveAssignment(
  organizationId: Id,
  branchId: Id,
  vehicleId: Id,
  createdBy: Id,
): Promise<void> {
  const existing = await VehicleAssignment.exists({
    vehicleId,
    status: ASSIGNMENT_STATUSES.ACTIVE,
  })
  if (existing) return
  await VehicleAssignment.create({
    vehicleId,
    organizationId,
    branchId,
    startsAt: new Date(Date.now() - DAY_MS),
    endsAt: new Date(Date.now() + 5 * DAY_MS),
    reason: 'Demo rental window',
    status: ASSIGNMENT_STATUSES.ACTIVE,
    createdBy,
  })
}

/** Four fake vehicles for Organization A (no real data). Amounts are decimal strings in PKR. */
async function seedDemoVehicles(
  organizationId: Id,
  legalEntityId: Id,
  branchA1: Id,
  branchA2: Id,
): Promise<void> {
  const admin = env.seedAdminEmail
    ? await User.findOne({ email: env.seedAdminEmail }).select('_id').lean()
    : null
  if (!admin) return
  const createdBy = admin._id

  const company = await ensureVehicle(organizationId, legalEntityId, createdBy, {
    plateNumber: 'DEV-A1-001',
    branchId: branchA1,
    make: 'Toyota',
    model: 'Corolla',
    year: 2023,
    category: VEHICLE_CATEGORIES.SEDAN,
    transmission: VEHICLE_TRANSMISSIONS.AUTOMATIC,
    fuelType: VEHICLE_FUEL_TYPES.PETROL,
    seatingCapacity: 5,
    mileageKm: 18000,
    ownershipType: OWNERSHIP_TYPES.COMPANY,
    status: VEHICLE_STATUSES.AVAILABLE,
    compliance: {
      registrationExpiresOn: utcDateFromToday(300),
      insuranceExpiresOn: utcDateFromToday(240),
      inspectionExpiresOn: utcDateFromToday(180),
    },
  })
  await ensureDailyRate(organizationId, company, createdBy, '15000.00')

  await ensureVehicle(organizationId, legalEntityId, createdBy, {
    plateNumber: 'DEV-A2-002',
    branchId: branchA2,
    make: 'Suzuki',
    model: 'Cultus',
    year: 2021,
    category: VEHICLE_CATEGORIES.SEDAN,
    transmission: VEHICLE_TRANSMISSIONS.MANUAL,
    fuelType: VEHICLE_FUEL_TYPES.PETROL,
    seatingCapacity: 4,
    mileageKm: 64000,
    ownershipType: OWNERSHIP_TYPES.INVESTOR,
    ownership: { investorName: 'Demo Investor One', investorReference: 'INV-DEMO-001' },
    status: VEHICLE_STATUSES.MAINTENANCE,
    compliance: {
      registrationExpiresOn: utcDateFromToday(200),
      insuranceExpiresOn: utcDateFromToday(12),
      inspectionExpiresOn: utcDateFromToday(120),
    },
  })

  const leased = await ensureVehicle(organizationId, legalEntityId, createdBy, {
    plateNumber: 'DEV-A1-003',
    branchId: branchA1,
    make: 'Toyota',
    model: 'Hiace',
    year: 2022,
    category: VEHICLE_CATEGORIES.VAN,
    transmission: VEHICLE_TRANSMISSIONS.MANUAL,
    fuelType: VEHICLE_FUEL_TYPES.DIESEL,
    seatingCapacity: 14,
    mileageKm: 41000,
    ownershipType: OWNERSHIP_TYPES.LEASED,
    ownership: {
      lessorName: 'Demo Leasing Co',
      leaseStartsOn: utcDateFromToday(-120),
      leaseEndsOn: utcDateFromToday(245),
      leaseAmount: '85000.00',
      leaseCurrency: 'PKR',
    },
    status: VEHICLE_STATUSES.RENTED,
    compliance: {
      registrationExpiresOn: utcDateFromToday(260),
      insuranceExpiresOn: utcDateFromToday(220),
      inspectionExpiresOn: utcDateFromToday(150),
    },
  })
  await ensureActiveAssignment(organizationId, branchA1, leased, createdBy)

  await ensureVehicle(organizationId, legalEntityId, createdBy, {
    plateNumber: 'DEV-A2-004',
    branchId: branchA2,
    make: 'Honda',
    model: 'City',
    year: 2018,
    category: VEHICLE_CATEGORIES.SEDAN,
    transmission: VEHICLE_TRANSMISSIONS.AUTOMATIC,
    fuelType: VEHICLE_FUEL_TYPES.PETROL,
    seatingCapacity: 5,
    mileageKm: 132000,
    ownershipType: OWNERSHIP_TYPES.BORROWED,
    ownership: { lenderName: 'Demo Lender', expectedReturnOn: utcDateFromToday(60) },
    status: VEHICLE_STATUSES.INACTIVE,
    compliance: {
      registrationExpiresOn: utcDateFromToday(-20),
      insuranceExpiresOn: utcDateFromToday(90),
      inspectionExpiresOn: utcDateFromToday(90),
    },
  })
}

const DEMO_CUSTOMER_PHONE = '+000 555 0100'

/**
 * Creates the customer only when its number is missing. Returns the existing or new id.
 * All values are obviously fake (no real identity numbers).
 */
async function ensureCustomer(
  organizationId: Id,
  legalEntityId: Id,
  createdBy: Id,
  input: {
    customerNumber: string
    branchId: Id
    type: CustomerType
    displayName: string
    email: string
    phone: string
    individual?: ICustomerIndividual
    corporate?: ICustomerCorporate
  },
): Promise<Id> {
  const existing = await Customer.findOne({ organizationId, customerNumber: input.customerNumber })
    .select('_id')
    .lean()
  if (existing) return existing._id

  const created = await Customer.create({
    organizationId,
    legalEntityId,
    branchId: input.branchId,
    customerNumber: input.customerNumber,
    type: input.type,
    status: CUSTOMER_STATUSES.ACTIVE,
    displayName: input.displayName,
    email: input.email,
    phone: input.phone,
    individual: input.individual,
    corporate: input.corporate,
    normalizedEmail: normalizeEmail(input.email),
    normalizedPhone: normalizePhone(input.phone),
    documentStatus: CUSTOMER_DOCUMENT_STATUSES.NONE,
    createdBy,
  })
  return created._id
}

/** Two fake customers sharing a phone number, plus the POTENTIAL duplicate review that links them. */
async function seedDemoCustomers(
  organizationId: Id,
  legalEntityId: Id,
  branchA1: Id,
  branchA2: Id,
): Promise<void> {
  const admin = env.seedAdminEmail
    ? await User.findOne({ email: env.seedAdminEmail }).select('_id').lean()
    : null
  if (!admin) return
  const createdBy = admin._id

  const individualId = await ensureCustomer(organizationId, legalEntityId, createdBy, {
    customerNumber: 'CUS-DEV-001',
    branchId: branchA1,
    type: CUSTOMER_TYPES.INDIVIDUAL,
    displayName: 'Demo Individual',
    email: 'demo.individual@example.test',
    phone: DEMO_CUSTOMER_PHONE,
    individual: { firstName: 'Demo', lastName: 'Individual', nationality: 'Demo' },
  })

  const hasContact = await CustomerContact.exists({ customerId: individualId, name: 'Demo Driver' })
  if (!hasContact) {
    await CustomerContact.create({
      customerId: individualId,
      organizationId,
      name: 'Demo Driver',
      phone: DEMO_CUSTOMER_PHONE,
      role: CONTACT_ROLES.DRIVER,
      licenseNumber: 'DEMO-0000',
      licenseExpiresOn: utcDateFromToday(365),
      isPrimary: true,
      status: CONTACT_STATUSES.ACTIVE,
    })
  }

  const corporateId = await ensureCustomer(organizationId, legalEntityId, createdBy, {
    customerNumber: 'CUS-DEV-002',
    branchId: branchA2,
    type: CUSTOMER_TYPES.CORPORATE,
    displayName: 'Demo Corporate Ltd',
    email: 'demo.corporate@example.test',
    phone: DEMO_CUSTOMER_PHONE,
    corporate: {
      legalName: 'Demo Corporate Ltd',
      registrationNumber: 'DEMO-0000',
      taxNumber: 'DEMO-0000',
    },
  })

  // Canonical pair: the smaller id is always `customerId`.
  const [low, high] =
    individualId.toHexString() < corporateId.toHexString()
      ? [individualId, corporateId]
      : [corporateId, individualId]
  await CustomerDuplicateReview.updateOne(
    { organizationId, customerId: low, candidateId: high },
    {
      $setOnInsert: { status: DUPLICATE_REVIEW_STATUSES.POTENTIAL },
      $addToSet: { signals: DUPLICATE_SIGNALS.PHONE },
    },
    { upsert: true },
  )
}

/** Fake bookings on DEV-A1-001. Adjacent confirmed windows touch at 12:00 and do not overlap. */
async function seedDemoBookings(organizationId: Id, branchId: Id): Promise<void> {
  const admin = env.seedAdminEmail
    ? await User.findOne({ email: env.seedAdminEmail }).select('_id').lean()
    : null
  const vehicle = await Vehicle.findOne({ organizationId, plateNumber: 'DEV-A1-001' })
    .select('_id legalEntityId')
    .lean()
  const customer = await Customer.findOne({ organizationId, customerNumber: 'CUS-DEV-001' })
    .select('_id displayName')
    .lean()
  if (!admin || !vehicle || !customer) return

  const midnight = new Date(Date.now() + 24 * 60 * 60 * 1000)
  midnight.setUTCHours(0, 0, 0, 0)
  const at = (hours: number) => new Date(midnight.getTime() + hours * 60 * 60 * 1000)

  const samples: Array<{
    bookingNumber: string
    status: (typeof BOOKING_STATUSES)[keyof typeof BOOKING_STATUSES]
    source: (typeof BOOKING_SOURCES)[keyof typeof BOOKING_SOURCES]
    startsAt: Date
    endsAt: Date
    holdExpiresAt?: Date
    block: boolean
  }> = [
    {
      bookingNumber: 'BK-DEV-001',
      status: BOOKING_STATUSES.CONFIRMED,
      source: BOOKING_SOURCES.ADMIN,
      startsAt: at(10),
      endsAt: at(12),
      block: true,
    },
    {
      bookingNumber: 'BK-DEV-002',
      status: BOOKING_STATUSES.CONFIRMED,
      source: BOOKING_SOURCES.WALK_IN,
      startsAt: at(12),
      endsAt: at(14),
      block: true,
    },
    {
      bookingNumber: 'BK-DEV-003',
      status: BOOKING_STATUSES.HOLD,
      source: BOOKING_SOURCES.WEBSITE,
      startsAt: at(16),
      endsAt: at(18),
      holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      block: true,
    },
    {
      bookingNumber: 'BK-DEV-004',
      status: BOOKING_STATUSES.EXPIRED,
      source: BOOKING_SOURCES.API,
      startsAt: at(-6),
      endsAt: at(-4),
      holdExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
      block: false,
    },
    {
      bookingNumber: 'BK-DEV-005',
      status: BOOKING_STATUSES.DRAFT,
      source: BOOKING_SOURCES.ADMIN,
      startsAt: at(30),
      endsAt: at(36),
      block: false,
    },
  ]

  for (const sample of samples) {
    const exists = await Booking.exists({ organizationId, bookingNumber: sample.bookingNumber })
    if (exists) continue
    let assignmentId: Id | undefined
    if (sample.block) {
      const assignment = await VehicleAssignment.create({
        vehicleId: vehicle._id,
        organizationId,
        branchId,
        startsAt: sample.startsAt,
        endsAt: sample.endsAt,
        reason: `Booking ${sample.bookingNumber}`,
        status: ASSIGNMENT_STATUSES.ACTIVE,
        createdBy: admin._id,
      })
      assignmentId = assignment._id
    }
    const booking = await Booking.create({
      organizationId,
      legalEntityId: vehicle.legalEntityId,
      branchId,
      returnBranchId: branchId,
      bookingNumber: sample.bookingNumber,
      customerId: customer._id,
      vehicleId: vehicle._id,
      vehicleCategory: 'SEDAN',
      customerDisplayName: customer.displayName,
      vehiclePlate: 'DEV-A1-001',
      startsAt: sample.startsAt,
      endsAt: sample.endsAt,
      status: sample.status,
      source: sample.source,
      holdExpiresAt: sample.holdExpiresAt,
      assignmentId,
      createdBy: admin._id,
    })
    await BookingStatusEvent.create({
      bookingId: booking._id,
      organizationId,
      branchId,
      toStatus: sample.status,
      reason: 'seed',
      actorUserId: admin._id,
    })
  }
}

/** Fake contracts. The active window starts 12 days out so it does not overlap the demo bookings. */
async function seedDemoContracts(organizationId: Id, branchId: Id): Promise<void> {
  const admin = env.seedAdminEmail
    ? await User.findOne({ email: env.seedAdminEmail }).select('_id').lean()
    : null
  const vehicle = await Vehicle.findOne({ organizationId, plateNumber: 'DEV-A1-001' }).lean()
  const borrowed = await Vehicle.findOne({ organizationId, plateNumber: 'DEV-A2-004' }).lean()
  const individual = await Customer.findOne({ organizationId, customerNumber: 'CUS-DEV-001' }).lean()
  const corporate = await Customer.findOne({ organizationId, customerNumber: 'CUS-DEV-002' }).lean()
  if (!admin || !vehicle || !borrowed || !individual || !corporate) return

  const day = 24 * 60 * 60 * 1000
  const base = new Date()
  base.setUTCHours(10, 0, 0, 0)
  const plus = (days: number) => new Date(base.getTime() + days * day)

  const drafts = [
    {
      contractNumber: 'CT-DEV-001',
      type: 'B2C',
      customer: individual,
      vehicle,
      lenderName: undefined as string | undefined,
    },
    {
      contractNumber: 'CT-DEV-002',
      type: 'B2B',
      customer: corporate,
      vehicle,
      lenderName: undefined as string | undefined,
    },
    {
      contractNumber: 'CT-DEV-003',
      type: 'BORROW',
      customer: individual,
      vehicle: borrowed,
      lenderName: 'Demo Lender',
    },
  ]
  for (const draft of drafts) {
    const exists = await Contract.exists({ organizationId, contractNumber: draft.contractNumber })
    if (exists) continue
    const contract = await Contract.create({
      organizationId,
      legalEntityId: draft.vehicle.legalEntityId,
      branchId,
      contractNumber: draft.contractNumber,
      type: draft.type,
      status: 'DRAFT',
      customerId: draft.customer._id,
      customerSnapshot: {
        customerNumber: draft.customer.customerNumber,
        displayName: draft.customer.displayName,
        type: draft.customer.type,
        email: draft.customer.email,
        phone: draft.customer.phone,
        companyName: draft.customer.corporate?.legalName,
      },
      currentVehicleId: draft.vehicle._id,
      currentPlate: draft.vehicle.plateNumber,
      startsAt: plus(40),
      endsAt: plus(45),
      lenderName: draft.lenderName,
      createdBy: admin._id,
    })
    await ContractTermsVersion.create({
      contractId: contract._id,
      organizationId,
      version: 1,
      content: 'Demo terms. Not a real agreement.',
      status: 'DRAFT',
      createdBy: admin._id,
    })
    await ContractStatusEvent.create({
      contractId: contract._id,
      organizationId,
      branchId,
      toStatus: 'DRAFT',
      reason: 'seed',
      actorUserId: admin._id,
    })
  }

  const activeNumber = 'CT-DEV-004'
  if (!(await Contract.exists({ organizationId, contractNumber: activeNumber }))) {
    const startsAt = plus(12)
    const originalEnd = plus(17)
    const extendedEnd = plus(22)
    const contract = await Contract.create({
      organizationId,
      legalEntityId: vehicle.legalEntityId,
      branchId,
      contractNumber: activeNumber,
      type: 'B2C',
      status: 'ACTIVE',
      customerId: individual._id,
      customerSnapshot: {
        customerNumber: individual.customerNumber,
        displayName: individual.displayName,
        type: individual.type,
      },
      currentVehicleId: vehicle._id,
      currentPlate: vehicle.plateNumber,
      startsAt,
      endsAt: extendedEnd,
      originalEndsAt: originalEnd,
      activatedAt: new Date(),
      approvedAt: new Date(),
      approvedBy: admin._id,
      createdBy: admin._id,
    })
    const terms = await ContractTermsVersion.create({
      contractId: contract._id,
      organizationId,
      version: 1,
      content: 'Demo terms accepted for the active sample.',
      status: 'ACCEPTED',
      effectiveAt: new Date(),
      createdBy: admin._id,
    })
    await Contract.updateOne({ _id: contract._id }, { $set: { acceptedTermsVersionId: terms._id } })
    await ContractSignature.create({
      contractId: contract._id,
      organizationId,
      termsVersionId: terms._id,
      signerName: 'Demo Individual',
      status: 'SIGNED',
      provider: 'internal',
      signedAt: new Date(),
    })
    const assignment = await VehicleAssignment.create({
      vehicleId: vehicle._id,
      organizationId,
      branchId,
      startsAt,
      endsAt: extendedEnd,
      plannedEndsAt: originalEnd,
      reason: `Contract ${activeNumber}`,
      status: ASSIGNMENT_STATUSES.ACTIVE,
      createdBy: admin._id,
      contractId: contract._id,
      assignmentType: 'CONTRACT',
      vehiclePlate: vehicle.plateNumber,
    })
    const extension = await ContractExtension.create({
      contractId: contract._id,
      organizationId,
      assignmentId: assignment._id,
      startsAt: originalEnd,
      endsAt: extendedEnd,
      currency: 'PKR',
      unitAmount: '15000.00',
      quantityDays: 5,
      totalAmount: '75000.00',
      rateType: 'DAILY',
      createdBy: admin._id,
    })
    await ContractCharge.create({
      contractId: contract._id,
      organizationId,
      kind: 'RENTAL',
      sourceId: String(contract._id),
      currency: 'PKR',
      unitAmount: '15000.00',
      quantityDays: 5,
      totalAmount: '75000.00',
      rateType: 'DAILY',
      periodStart: startsAt,
      periodEnd: originalEnd,
      createdBy: admin._id,
    })
    await ContractCharge.create({
      contractId: contract._id,
      organizationId,
      kind: 'EXTENSION',
      sourceId: String(extension._id),
      currency: 'PKR',
      unitAmount: '15000.00',
      quantityDays: 5,
      totalAmount: '75000.00',
      rateType: 'DAILY',
      periodStart: originalEnd,
      periodEnd: extendedEnd,
      createdBy: admin._id,
    })
    await ContractHandover.create({
      contractId: contract._id,
      organizationId,
      assignmentId: assignment._id,
      occurredAt: startsAt,
      mileageKm: 18000,
      fuelPercent: 80,
      condition: 'Clean',
      acknowledged: true,
      staffUserId: admin._id,
    })
    await ContractStatusEvent.create({
      contractId: contract._id,
      organizationId,
      branchId,
      toStatus: 'ACTIVE',
      reason: 'seed',
      actorUserId: admin._id,
    })
  }

  const completedNumber = 'CT-DEV-005'
  if (!(await Contract.exists({ organizationId, contractNumber: completedNumber }))) {
    const startsAt = plus(-20)
    const endsAt = plus(-15)
    const contract = await Contract.create({
      organizationId,
      legalEntityId: vehicle.legalEntityId,
      branchId,
      contractNumber: completedNumber,
      type: 'B2C',
      status: 'COMPLETED',
      customerId: individual._id,
      customerSnapshot: {
        customerNumber: individual.customerNumber,
        displayName: individual.displayName,
        type: individual.type,
      },
      currentVehicleId: vehicle._id,
      currentPlate: vehicle.plateNumber,
      startsAt,
      endsAt,
      originalEndsAt: endsAt,
      createdBy: admin._id,
    })
    const assignment = await VehicleAssignment.create({
      vehicleId: vehicle._id,
      organizationId,
      branchId,
      startsAt,
      endsAt,
      plannedEndsAt: endsAt,
      reason: `Contract ${completedNumber}`,
      status: ASSIGNMENT_STATUSES.RELEASED,
      createdBy: admin._id,
      contractId: contract._id,
      assignmentType: 'CONTRACT',
      vehiclePlate: vehicle.plateNumber,
    })
    await ContractHandover.create({
      contractId: contract._id,
      organizationId,
      assignmentId: assignment._id,
      occurredAt: startsAt,
      mileageKm: 17000,
      fuelPercent: 100,
      condition: 'Clean',
      acknowledged: true,
      staffUserId: admin._id,
    })
    await ContractReturn.create({
      contractId: contract._id,
      organizationId,
      assignmentId: assignment._id,
      occurredAt: endsAt,
      mileageKm: 17500,
      fuelPercent: 40,
      condition: 'Returned',
      acknowledged: true,
      staffUserId: admin._id,
    })
  }
}

async function seedDemoFinance(organizationId: Id, branchId: Id): Promise<void> {
  const admin = env.seedAdminEmail
    ? await User.findOne({ email: env.seedAdminEmail }).select('_id').lean()
    : null
  const individual = await Customer.findOne({ organizationId, customerNumber: 'CUS-DEV-001' }).lean()
  const contract = await Contract.findOne({ organizationId, contractNumber: 'CT-DEV-004' }).lean()
  if (!admin || !individual || !contract) return

  if (!(await Invoice.exists({ organizationId, documentNumber: 'INV-DEV-001' }))) {
    const invoice = await Invoice.create({
      organizationId,
      legalEntityId: individual.legalEntityId,
      branchId,
      documentNumber: 'INV-DEV-001',
      customerId: individual._id,
      customerDisplayName: individual.displayName,
      contractId: contract._id,
      currency: 'AED',
      documentDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'POSTED',
      subtotal: '1000.00',
      discountTotal: '0.00',
      taxableAmount: '1000.00',
      taxAmount: '50.00',
      totalAmount: '1050.00',
      paidAmount: '500.00',
      creditedAmount: '0.00',
      outstandingAmount: '550.00',
      notes: 'Demo posted invoice',
      createdBy: admin._id,
      postedBy: admin._id,
      postedAt: new Date(),
    })
    await InvoiceLine.create({
      invoiceId: invoice._id,
      organizationId,
      description: 'Demo rental charge',
      quantity: 5,
      unitPrice: '200.00',
      discountAmount: '0.00',
      taxRatePercent: '5.00',
      lineSubtotal: '1000.00',
      taxableAmount: '1000.00',
      taxAmount: '50.00',
      lineTotal: '1050.00',
      sourceType: 'MANUAL',
      sortOrder: 0,
    })
  }

  if (!(await Invoice.exists({ organizationId, documentNumber: 'INV-DEV-002' })) && !(await Invoice.exists({ organizationId, status: 'DRAFT', notes: 'Demo draft invoice' }))) {
    const draft = await Invoice.create({
      organizationId,
      legalEntityId: individual.legalEntityId,
      branchId,
      customerId: individual._id,
      customerDisplayName: individual.displayName,
      contractId: contract._id,
      currency: 'AED',
      documentDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'DRAFT',
      subtotal: '200.00',
      discountTotal: '0.00',
      taxableAmount: '200.00',
      taxAmount: '10.00',
      totalAmount: '210.00',
      paidAmount: '0.00',
      creditedAmount: '0.00',
      outstandingAmount: '210.00',
      notes: 'Demo draft invoice',
      createdBy: admin._id,
    })
    await InvoiceLine.create({
      invoiceId: draft._id,
      organizationId,
      description: 'Demo extension charge',
      quantity: 1,
      unitPrice: '200.00',
      discountAmount: '0.00',
      taxRatePercent: '5.00',
      lineSubtotal: '200.00',
      taxableAmount: '200.00',
      taxAmount: '10.00',
      lineTotal: '210.00',
      sourceType: 'MANUAL',
      sortOrder: 0,
    })
  }

  const posted = await Invoice.findOne({ organizationId, documentNumber: 'INV-DEV-001' }).lean()
  if (posted && !(await Payment.exists({ organizationId, paymentNumber: 'PAY-DEV-001' }))) {
    const payment = await Payment.create({
      organizationId,
      legalEntityId: individual.legalEntityId,
      branchId,
      paymentNumber: 'PAY-DEV-001',
      customerId: individual._id,
      customerDisplayName: individual.displayName,
      currency: 'AED',
      amount: '500.00',
      allocatedAmount: '500.00',
      unallocatedAmount: '0.00',
      method: 'CARD',
      paymentDate: new Date(),
      status: 'COMPLETED',
      notes: 'Demo payment',
      createdBy: admin._id,
      completedAt: new Date(),
    })
    await PaymentAllocation.create({
      paymentId: payment._id,
      invoiceId: posted._id,
      organizationId,
      amount: '500.00',
      createdBy: admin._id,
    })
    if (!(await Receipt.exists({ organizationId, receiptNumber: 'RCP-DEV-001' }))) {
      await Receipt.create({
        organizationId,
        legalEntityId: individual.legalEntityId,
        branchId,
        receiptNumber: 'RCP-DEV-001',
        paymentId: payment._id,
        customerId: individual._id,
        customerDisplayName: individual.displayName,
        currency: 'AED',
        amount: '500.00',
        method: 'CARD',
        issuedAt: new Date(),
        status: 'POSTED',
        createdBy: admin._id,
      })
    }
  }

  if (!(await CreditNote.exists({ organizationId, documentNumber: 'CN-DEV-001' })) && posted) {
    await CreditNote.create({
      organizationId,
      legalEntityId: individual.legalEntityId,
      branchId,
      documentNumber: 'CN-DEV-001',
      customerId: individual._id,
      customerDisplayName: individual.displayName,
      invoiceId: posted._id,
      contractId: contract._id,
      currency: 'AED',
      documentDate: new Date(),
      reason: 'Demo partial credit',
      status: 'POSTED',
      subtotal: '100.00',
      discountTotal: '0.00',
      taxableAmount: '100.00',
      taxAmount: '5.00',
      totalAmount: '105.00',
      createdBy: admin._id,
      postedBy: admin._id,
      postedAt: new Date(),
    })
  }

  if (!(await DebitNote.exists({ organizationId, documentNumber: 'DN-DEV-001' })) && posted) {
    await DebitNote.create({
      organizationId,
      legalEntityId: individual.legalEntityId,
      branchId,
      documentNumber: 'DN-DEV-001',
      customerId: individual._id,
      customerDisplayName: individual.displayName,
      invoiceId: posted._id,
      contractId: contract._id,
      currency: 'AED',
      documentDate: new Date(),
      reason: 'Demo additional charge',
      status: 'POSTED',
      subtotal: '50.00',
      discountTotal: '0.00',
      taxableAmount: '50.00',
      taxAmount: '2.50',
      totalAmount: '52.50',
      createdBy: admin._id,
      postedBy: admin._id,
      postedAt: new Date(),
    })
  }

  if (!(await Deposit.exists({ organizationId, depositNumber: 'DEP-DEV-001' }))) {
    await Deposit.create({
      organizationId,
      legalEntityId: individual.legalEntityId,
      branchId,
      depositNumber: 'DEP-DEV-001',
      customerId: individual._id,
      customerDisplayName: individual.displayName,
      contractId: contract._id,
      currency: 'AED',
      amount: '2000.00',
      appliedAmount: '0.00',
      releasedAmount: '0.00',
      remainingAmount: '2000.00',
      status: 'HELD',
      heldAt: new Date(),
      notes: 'Demo security deposit',
      createdBy: admin._id,
    })
  }
}

async function main(): Promise<void> {
  if (!env.seedAdminEmail || !env.seedAdminPassword) {
    logger.info('Seed skipped because SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are not both set')
    return
  }

  await connectDatabase()
  await seedSystemRoles()

  const orgA = await ensureOrganization('ORG-A', 'Organization A')
  const leA = await ensureLegalEntity(orgA, 'Organization A Holdings Ltd', 'Org A Holdings')

  // The env admin is the Organization A admin with organization-wide scope.
  await ensureUser({
    email: env.seedAdminEmail,
    name: 'Administrator',
    password: env.seedAdminPassword,
    role: ROLES.ADMIN,
    organizationId: orgA,
    legalEntityIds: [leA],
    accessAllBranches: true,
  })

  if (env.isProduction) {
    logger.info('Production seed: roles, Organization A and the administrator only', {
      email: env.seedAdminEmail,
    })
    return
  }

  const branchA1 = await ensureBranch(orgA, leA, 'A1', 'Branch A1')
  const branchA2 = await ensureBranch(orgA, leA, 'A2', 'Branch A2')
  await seedDemoVehicles(orgA, leA, branchA1, branchA2)
  await seedDemoCustomers(orgA, leA, branchA1, branchA2)
  await seedDemoBookings(orgA, branchA1)
  await seedDemoContracts(orgA, branchA1)
  await seedDemoFinance(orgA, branchA1)

  const orgB = await ensureOrganization('ORG-B', 'Organization B')
  const leB = await ensureLegalEntity(orgB, 'Organization B Trading Ltd', 'Org B Trading')
  await ensureBranch(orgB, leB, 'B1', 'Branch B1')

  await ensureUser({
    email: DEV_EMAILS.superAdmin,
    name: 'Dev Super Admin',
    password: DEV_PASSWORD,
    role: ROLES.SUPER_ADMIN,
    organizationId: null,
    accessAllOrganizations: true,
    accessAllBranches: true,
  })
  await ensureUser({
    email: DEV_EMAILS.branchManagerA1,
    name: 'Dev Branch Manager A1',
    password: DEV_PASSWORD,
    role: ROLES.MANAGER,
    organizationId: orgA,
    legalEntityIds: [leA],
    branchIds: [branchA1],
  })
  await ensureUser({
    email: DEV_EMAILS.adminB,
    name: 'Dev Admin B',
    password: DEV_PASSWORD,
    role: ROLES.ADMIN,
    organizationId: orgB,
    legalEntityIds: [leB],
    accessAllBranches: true,
  })

  logger.info('Administrator and demo tenancy data are ready', {
    email: env.seedAdminEmail,
    demoAccounts: Object.values(DEV_EMAILS),
  })
}

main()
  .catch((error: unknown) => {
    logger.error('Seed failed', { name: error instanceof Error ? error.name : 'Error' })
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDatabase()
  })
