import { Types } from 'mongoose'
import { Booking } from '../../models/booking.model.js'
import { Contract } from '../../models/contract.model.js'
import { Customer } from '../../models/customer.model.js'
import { Fine, Refund, Toll } from '../../models/charges.model.js'
import { Invoice, Payment } from '../../models/finance.model.js'
import { Expense, WorkOrder } from '../../models/procurement.model.js'
import { EInvoiceDocument } from '../../models/tax.model.js'
import { Vehicle } from '../../models/vehicle.model.js'
import { VehicleAssignment } from '../../models/vehicle-assignment.model.js'
import { DOC_STATUSES, PAYMENT_STATUSES } from '../../constants/finance.js'
import { CONTRACT_STATUSES } from '../../constants/contracts.js'
import { UTILIZATION_ELIGIBLE_STATUSES } from '../../constants/reporting.js'
import { ASSIGNMENT_STATUSES, VEHICLE_STATUSES } from '../../constants/vehicles.js'
import { toObjectId, toObjectIds } from '../object-id.js'
import { addMoney, normalizeMoney } from '../../utils/money.js'

export type ScopeFilter = {
  organizationId: string
  branchIds?: readonly string[]
  legalEntityIds?: readonly string[]
  branchId?: string
  legalEntityId?: string
}

function oid(value: string): Types.ObjectId {
  const id = toObjectId(value)
  if (!id) throw new Error(`Invalid ObjectId: ${value}`)
  return id
}

export function buildScopeMatch(scope: ScopeFilter): Record<string, unknown> {
  const match: Record<string, unknown> = { organizationId: oid(scope.organizationId) }
  if (scope.branchId) match.branchId = oid(scope.branchId)
  else if (scope.branchIds) match.branchId = { $in: toObjectIds(scope.branchIds) }
  if (scope.legalEntityId) match.legalEntityId = oid(scope.legalEntityId)
  else if (scope.legalEntityIds) match.legalEntityId = { $in: toObjectIds(scope.legalEntityIds) }
  return match
}

function decimalSum(field: string) {
  return { $sum: { $toDecimal: `$${field}` } }
}

function moneyFromAgg(value: unknown): string {
  if (value == null) return '0.00'
  return normalizeMoney(String(value))
}

/** Posted invoice totals in [from, toExclusive) by documentDate — operational revenue. */
export async function sumPostedInvoiceRevenue(
  scope: ScopeFilter,
  from: Date,
  toExclusive: Date,
): Promise<{ amount: string; count: number; currency: string | null }> {
  const rows = await Invoice.aggregate([
    {
      $match: {
        ...buildScopeMatch(scope),
        status: DOC_STATUSES.POSTED,
        documentDate: { $gte: from, $lt: toExclusive },
      },
    },
    {
      $group: {
        _id: '$currency',
        amount: decimalSum('totalAmount'),
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ])
  if (rows.length === 0) return { amount: '0.00', count: 0, currency: null }
  const primary = rows[0]!
  let total = moneyFromAgg(primary.amount)
  let count = primary.count as number
  for (const row of rows.slice(1)) {
    // Multi-currency: sum only matching primary currency; others reported separately is out of scope.
    if (String(row._id) === String(primary._id)) {
      total = moneyFromAgg(row.amount)
      count += row.count as number
    }
  }
  return { amount: total, count, currency: primary._id ? String(primary._id) : null }
}

export async function revenueTrend(
  scope: ScopeFilter,
  from: Date,
  toExclusive: Date,
  groupBy: 'DAY' | 'WEEK' | 'MONTH',
): Promise<Array<{ period: string; amount: string; count: number }>> {
  const dateFormat =
    groupBy === 'MONTH' ? '%Y-%m' : groupBy === 'WEEK' ? '%G-W%V' : '%Y-%m-%d'
  const rows = await Invoice.aggregate([
    {
      $match: {
        ...buildScopeMatch(scope),
        status: DOC_STATUSES.POSTED,
        documentDate: { $gte: from, $lt: toExclusive },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$documentDate' } },
        amount: decimalSum('totalAmount'),
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])
  return rows.map((row) => ({
    period: String(row._id),
    amount: moneyFromAgg(row.amount),
    count: row.count as number,
  }))
}

export async function countBookingsByStatus(
  scope: ScopeFilter,
  from: Date,
  toExclusive: Date,
): Promise<Record<string, number>> {
  const rows = await Booking.aggregate([
    {
      $match: {
        ...buildScopeMatch(scope),
        createdAt: { $gte: from, $lt: toExclusive },
      },
    },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count as number]))
}

export async function bookingTrend(
  scope: ScopeFilter,
  from: Date,
  toExclusive: Date,
  groupBy: 'DAY' | 'WEEK' | 'MONTH',
): Promise<Array<{ period: string; count: number }>> {
  const dateFormat =
    groupBy === 'MONTH' ? '%Y-%m' : groupBy === 'WEEK' ? '%G-W%V' : '%Y-%m-%d'
  const rows = await Booking.aggregate([
    {
      $match: {
        ...buildScopeMatch(scope),
        createdAt: { $gte: from, $lt: toExclusive },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])
  return rows.map((row) => ({ period: String(row._id), count: row.count as number }))
}

export async function countContractsByStatus(scope: ScopeFilter): Promise<Record<string, number>> {
  const rows = await Contract.aggregate([
    { $match: buildScopeMatch(scope) },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count as number]))
}

export async function countActiveContracts(scope: ScopeFilter): Promise<number> {
  return Contract.countDocuments({
    ...buildScopeMatch(scope),
    status: CONTRACT_STATUSES.ACTIVE,
  })
}

export async function countOverdueContracts(scope: ScopeFilter, now = new Date()): Promise<number> {
  return Contract.countDocuments({
    ...buildScopeMatch(scope),
    status: CONTRACT_STATUSES.ACTIVE,
    endsAt: { $lt: now },
  })
}

export async function listUpcomingReturns(
  scope: ScopeFilter,
  from: Date,
  toExclusive: Date,
  limit = 20,
) {
  const docs = await Contract.find({
    ...buildScopeMatch(scope),
    status: CONTRACT_STATUSES.ACTIVE,
    endsAt: { $gte: from, $lt: toExclusive },
  })
    .sort({ endsAt: 1 })
    .limit(limit)
    .lean()
  return docs.map((doc) => ({
    id: doc._id.toString(),
    contractNumber: String(doc.contractNumber),
    customerId: doc.customerId.toString(),
    customerName: doc.customerSnapshot?.displayName ? String(doc.customerSnapshot.displayName) : null,
    vehicleId: doc.currentVehicleId ? doc.currentVehicleId.toString() : null,
    vehiclePlate: doc.currentPlate ? String(doc.currentPlate) : null,
    endsAt: doc.endsAt as Date,
    branchId: doc.branchId.toString(),
    status: String(doc.status),
  }))
}

export async function listOverdueContracts(scope: ScopeFilter, now = new Date(), limit = 50) {
  const docs = await Contract.find({
    ...buildScopeMatch(scope),
    status: CONTRACT_STATUSES.ACTIVE,
    endsAt: { $lt: now },
  })
    .sort({ endsAt: 1 })
    .limit(limit)
    .lean()
  return docs.map((doc) => {
    const endsAt = doc.endsAt as Date
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - endsAt.getTime()) / (24 * 60 * 60 * 1000)))
    return {
      id: doc._id.toString(),
      contractNumber: String(doc.contractNumber),
      customerId: doc.customerId.toString(),
      customerName: doc.customerSnapshot?.displayName ? String(doc.customerSnapshot.displayName) : null,
      vehicleId: doc.currentVehicleId ? doc.currentVehicleId.toString() : null,
      vehiclePlate: doc.currentPlate ? String(doc.currentPlate) : null,
      endsAt,
      daysOverdue,
      branchId: doc.branchId.toString(),
      status: String(doc.status),
    }
  })
}

export async function fleetStatusCounts(scope: ScopeFilter): Promise<Record<string, number>> {
  const rows = await Vehicle.aggregate([
    { $match: buildScopeMatch(scope) },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count as number]))
}

export async function fleetUtilizationSnapshot(scope: ScopeFilter): Promise<{
  rented: number
  eligible: number
  available: number
  utilizationPercent: number | null
}> {
  const match = buildScopeMatch(scope)
  const [rented, eligible, available] = await Promise.all([
    Vehicle.countDocuments({ ...match, status: VEHICLE_STATUSES.RENTED }),
    Vehicle.countDocuments({ ...match, status: { $in: [...UTILIZATION_ELIGIBLE_STATUSES] } }),
    Vehicle.countDocuments({ ...match, status: VEHICLE_STATUSES.AVAILABLE }),
  ])
  const utilizationPercent =
    eligible === 0 ? null : Math.round((rented / eligible) * 10000) / 100
  return { rented, eligible, available, utilizationPercent }
}

/** Receivables from posted invoices with outstanding > 0 (finance source of truth for AR). */
export async function sumOutstandingReceivables(scope: ScopeFilter): Promise<{
  amount: string
  count: number
  currency: string | null
}> {
  const rows = await Invoice.aggregate([
    {
      $match: {
        ...buildScopeMatch(scope),
        status: DOC_STATUSES.POSTED,
        outstandingAmount: { $nin: ['0', '0.0', '0.00'] },
      },
    },
    {
      $group: {
        _id: '$currency',
        amount: decimalSum('outstandingAmount'),
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ])
  if (rows.length === 0) return { amount: '0.00', count: 0, currency: null }
  const primary = rows[0]!
  return {
    amount: moneyFromAgg(primary.amount),
    count: primary.count as number,
    currency: primary._id ? String(primary._id) : null,
  }
}

export async function sumCompletedPayments(
  scope: ScopeFilter,
  from: Date,
  toExclusive: Date,
): Promise<{ amount: string; count: number }> {
  const rows = await Payment.aggregate([
    {
      $match: {
        ...buildScopeMatch(scope),
        status: PAYMENT_STATUSES.COMPLETED,
        paymentDate: { $gte: from, $lt: toExclusive },
      },
    },
    {
      $group: {
        _id: null,
        amount: decimalSum('amount'),
        count: { $sum: 1 },
      },
    },
  ])
  const row = rows[0]
  return { amount: moneyFromAgg(row?.amount), count: (row?.count as number) ?? 0 }
}

export async function recentBookings(scope: ScopeFilter, limit = 8) {
  const docs = await Booking.find(buildScopeMatch(scope)).sort({ createdAt: -1 }).limit(limit).lean()
  return docs.map((doc) => ({
    id: doc._id.toString(),
    bookingNumber: String(doc.bookingNumber),
    customerName: String(doc.customerDisplayName),
    vehiclePlate: doc.vehiclePlate ? String(doc.vehiclePlate) : null,
    status: String(doc.status),
    startsAt: doc.startsAt as Date,
    endsAt: doc.endsAt as Date,
    estimatedAmount: doc.pricing?.totalAmount ? String(doc.pricing.totalAmount) : null,
    currency: doc.pricing?.currency ? String(doc.pricing.currency) : null,
    createdAt: doc.createdAt as Date,
  }))
}

export async function recentPayments(scope: ScopeFilter, limit = 8) {
  const docs = await Payment.find(buildScopeMatch(scope)).sort({ paymentDate: -1 }).limit(limit).lean()
  return docs.map((doc) => ({
    id: doc._id.toString(),
    paymentNumber: doc.paymentNumber ? String(doc.paymentNumber) : null,
    customerName: String(doc.customerDisplayName),
    amount: String(doc.amount),
    currency: String(doc.currency),
    method: String(doc.method),
    status: String(doc.status),
    paymentDate: doc.paymentDate as Date,
  }))
}

export async function recentContracts(scope: ScopeFilter, limit = 8) {
  const docs = await Contract.find(buildScopeMatch(scope)).sort({ createdAt: -1 }).limit(limit).lean()
  return docs.map((doc) => ({
    id: doc._id.toString(),
    contractNumber: String(doc.contractNumber),
    customerName: doc.customerSnapshot?.displayName ? String(doc.customerSnapshot.displayName) : null,
    vehiclePlate: doc.currentPlate ? String(doc.currentPlate) : null,
    status: String(doc.status),
    startsAt: doc.startsAt as Date,
    endsAt: doc.endsAt as Date,
  }))
}

export async function listBookingsReport(
  scope: ScopeFilter,
  filters: {
    from?: Date
    toExclusive?: Date
    status?: string
    customerId?: string
    vehicleId?: string
    skip: number
    take: number
    sort: string
    order: 'asc' | 'desc'
  },
) {
  const match: Record<string, unknown> = { ...buildScopeMatch(scope) }
  if (filters.from || filters.toExclusive) {
    match.createdAt = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.toExclusive ? { $lt: filters.toExclusive } : {}),
    }
  }
  if (filters.status) match.status = filters.status
  if (filters.customerId) match.customerId = oid(filters.customerId)
  if (filters.vehicleId) match.vehicleId = oid(filters.vehicleId)

  const sortField = ['bookingNumber', 'startsAt', 'endsAt', 'createdAt', 'status'].includes(filters.sort)
    ? filters.sort
    : 'createdAt'
  const [items, total] = await Promise.all([
    Booking.find(match)
      .sort({ [sortField]: filters.order === 'asc' ? 1 : -1 })
      .skip(filters.skip)
      .limit(filters.take)
      .lean(),
    Booking.countDocuments(match),
  ])
  return {
    total,
    items: items.map((doc) => ({
      id: doc._id.toString(),
      bookingNumber: String(doc.bookingNumber),
      customerId: doc.customerId.toString(),
      customerName: String(doc.customerDisplayName),
      vehicleId: doc.vehicleId ? doc.vehicleId.toString() : null,
      vehiclePlate: doc.vehiclePlate ? String(doc.vehiclePlate) : null,
      vehicleCategory: doc.vehicleCategory ? String(doc.vehicleCategory) : null,
      createdAt: doc.createdAt as Date,
      startsAt: doc.startsAt as Date,
      endsAt: doc.endsAt as Date,
      status: String(doc.status),
      branchId: doc.branchId.toString(),
      estimatedAmount: doc.pricing?.totalAmount ? String(doc.pricing.totalAmount) : null,
      currency: doc.pricing?.currency ? String(doc.pricing.currency) : null,
    })),
  }
}

export async function listVehiclesReport(
  scope: ScopeFilter,
  filters: {
    status?: string
    category?: string
    skip: number
    take: number
    sort: string
    order: 'asc' | 'desc'
  },
) {
  const match: Record<string, unknown> = { ...buildScopeMatch(scope) }
  if (filters.status) match.status = filters.status
  if (filters.category) match.category = filters.category
  const sortField = ['plateNumber', 'make', 'model', 'status', 'createdAt'].includes(filters.sort)
    ? filters.sort
    : 'plateNumber'
  const [items, total] = await Promise.all([
    Vehicle.find(match)
      .sort({ [sortField]: filters.order === 'asc' ? 1 : -1 })
      .skip(filters.skip)
      .limit(filters.take)
      .lean(),
    Vehicle.countDocuments(match),
  ])

  const vehicleIds = items.map((doc) => doc._id)
  const activeContracts =
    vehicleIds.length === 0
      ? []
      : await Contract.find({
          organizationId: oid(scope.organizationId),
          status: CONTRACT_STATUSES.ACTIVE,
          currentVehicleId: { $in: vehicleIds },
        })
          .select({ currentVehicleId: 1, contractNumber: 1, customerSnapshot: 1, customerId: 1 })
          .lean()

  const byVehicle = new Map(
    activeContracts.map((c) => [
      c.currentVehicleId?.toString() ?? '',
      {
        contractNumber: String(c.contractNumber),
        customerId: c.customerId.toString(),
        customerName: c.customerSnapshot?.displayName ? String(c.customerSnapshot.displayName) : null,
      },
    ]),
  )

  return {
    total,
    items: items.map((doc) => {
      const id = doc._id.toString()
      const contract = byVehicle.get(id)
      return {
        id,
        plateNumber: String(doc.plateNumber),
        make: String(doc.make),
        model: String(doc.model),
        year: Number(doc.year),
        category: String(doc.category),
        status: String(doc.status),
        branchId: doc.branchId.toString(),
        legalEntityId: doc.legalEntityId.toString(),
        currentContractNumber: contract?.contractNumber ?? null,
        currentCustomerId: contract?.customerId ?? null,
        currentCustomerName: contract?.customerName ?? null,
        available: doc.status === VEHICLE_STATUSES.AVAILABLE,
      }
    }),
  }
}

export async function fleetUtilizationByVehicle(
  scope: ScopeFilter,
  from: Date,
  toExclusive: Date,
  filters: { vehicleId?: string; category?: string; skip: number; take: number },
) {
  const vehicleMatch: Record<string, unknown> = {
    ...buildScopeMatch(scope),
    status: { $in: [...UTILIZATION_ELIGIBLE_STATUSES, VEHICLE_STATUSES.OUT_OF_SERVICE] },
  }
  if (filters.vehicleId) vehicleMatch._id = oid(filters.vehicleId)
  if (filters.category) vehicleMatch.category = filters.category

  const [vehicles, total] = await Promise.all([
    Vehicle.find(vehicleMatch).sort({ plateNumber: 1 }).skip(filters.skip).limit(filters.take).lean(),
    Vehicle.countDocuments(vehicleMatch),
  ])

  const vehicleIds = vehicles.map((v) => v._id)
  const assignments =
    vehicleIds.length === 0
      ? []
      : await VehicleAssignment.find({
          organizationId: oid(scope.organizationId),
          vehicleId: { $in: vehicleIds },
          status: { $in: [ASSIGNMENT_STATUSES.ACTIVE, ASSIGNMENT_STATUSES.RELEASED] },
          startsAt: { $lt: toExclusive },
          endsAt: { $gt: from },
        }).lean()

  const periodMs = toExclusive.getTime() - from.getTime()
  const availableDays = Math.max(1, Math.round(periodMs / (24 * 60 * 60 * 1000)))

  const rentedMsByVehicle = new Map<string, number>()
  for (const a of assignments) {
    const start = Math.max((a.startsAt as Date).getTime(), from.getTime())
    const end = Math.min((a.endsAt as Date).getTime(), toExclusive.getTime())
    if (end <= start) continue
    const key = a.vehicleId.toString()
    rentedMsByVehicle.set(key, (rentedMsByVehicle.get(key) ?? 0) + (end - start))
  }

  const revenueRows =
    vehicleIds.length === 0
      ? []
      : await Invoice.aggregate([
          {
            $match: {
              ...buildScopeMatch(scope),
              status: DOC_STATUSES.POSTED,
              documentDate: { $gte: from, $lt: toExclusive },
              contractId: { $exists: true },
            },
          },
          {
            $lookup: {
              from: 'contracts',
              localField: 'contractId',
              foreignField: '_id',
              as: 'contract',
            },
          },
          { $unwind: '$contract' },
          {
            $match: {
              'contract.currentVehicleId': { $in: vehicleIds },
            },
          },
          {
            $group: {
              _id: '$contract.currentVehicleId',
              amount: decimalSum('totalAmount'),
            },
          },
        ])

  const revenueByVehicle = new Map(
    revenueRows.map((row) => [row._id.toString(), moneyFromAgg(row.amount)]),
  )

  return {
    total,
    availableDays,
    items: vehicles.map((v) => {
      const id = v._id.toString()
      const rentedMs = rentedMsByVehicle.get(id) ?? 0
      const rentedDays = Math.round((rentedMs / (24 * 60 * 60 * 1000)) * 100) / 100
      const utilizationPercent =
        availableDays === 0 ? null : Math.round((rentedDays / availableDays) * 10000) / 100
      return {
        vehicleId: id,
        plateNumber: String(v.plateNumber),
        category: String(v.category),
        status: String(v.status),
        branchId: v.branchId.toString(),
        availableDays,
        rentedDays,
        utilizationPercent,
        revenue: revenueByVehicle.get(id) ?? '0.00',
      }
    }),
  }
}

export async function listCustomersReport(
  scope: ScopeFilter,
  filters: { skip: number; take: number; search?: string },
) {
  const match: Record<string, unknown> = { ...buildScopeMatch(scope) }
  if (filters.search?.trim()) {
    const q = filters.search.trim()
    match.$or = [
      { displayName: { $regex: q, $options: 'i' } },
      { customerNumber: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ]
  }
  const [items, total] = await Promise.all([
    Customer.find(match).sort({ displayName: 1 }).skip(filters.skip).limit(filters.take).lean(),
    Customer.countDocuments(match),
  ])
  const customerIds = items.map((c) => c._id)

  const [bookingCounts, activeContracts, invoiceStats, paymentStats] = await Promise.all([
    customerIds.length === 0
      ? []
      : Booking.aggregate([
          { $match: { ...buildScopeMatch(scope), customerId: { $in: customerIds } } },
          { $group: { _id: '$customerId', count: { $sum: 1 } } },
        ]),
    customerIds.length === 0
      ? []
      : Contract.aggregate([
          {
            $match: {
              ...buildScopeMatch(scope),
              customerId: { $in: customerIds },
              status: CONTRACT_STATUSES.ACTIVE,
            },
          },
          { $group: { _id: '$customerId', count: { $sum: 1 } } },
        ]),
    customerIds.length === 0
      ? []
      : Invoice.aggregate([
          {
            $match: {
              ...buildScopeMatch(scope),
              customerId: { $in: customerIds },
              status: DOC_STATUSES.POSTED,
            },
          },
          {
            $group: {
              _id: '$customerId',
              invoiced: decimalSum('totalAmount'),
              outstanding: decimalSum('outstandingAmount'),
            },
          },
        ]),
    customerIds.length === 0
      ? []
      : Payment.aggregate([
          {
            $match: {
              ...buildScopeMatch(scope),
              customerId: { $in: customerIds },
              status: PAYMENT_STATUSES.COMPLETED,
            },
          },
          { $group: { _id: '$customerId', paid: decimalSum('amount') } },
        ]),
  ])

  const bookingsMap = new Map(bookingCounts.map((r) => [r._id.toString(), r.count as number]))
  const contractsMap = new Map(activeContracts.map((r) => [r._id.toString(), r.count as number]))
  const invoiceMap = new Map(
    invoiceStats.map((r) => [
      r._id.toString(),
      { invoiced: moneyFromAgg(r.invoiced), outstanding: moneyFromAgg(r.outstanding) },
    ]),
  )
  const paidMap = new Map(paymentStats.map((r) => [r._id.toString(), moneyFromAgg(r.paid)]))

  return {
    total,
    items: items.map((doc) => {
      const id = doc._id.toString()
      const inv = invoiceMap.get(id)
      return {
        id,
        customerNumber: doc.customerNumber ? String(doc.customerNumber) : null,
        displayName: String(doc.displayName),
        type: String(doc.type),
        activeContracts: contractsMap.get(id) ?? 0,
        totalBookings: bookingsMap.get(id) ?? 0,
        totalInvoiced: inv?.invoiced ?? '0.00',
        totalPaid: paidMap.get(id) ?? '0.00',
        outstandingBalance: inv?.outstanding ?? '0.00',
        lastActivityAt: (doc.updatedAt as Date) ?? null,
        branchId: doc.branchId.toString(),
      }
    }),
  }
}

export async function customerPerformance(
  scope: ScopeFilter,
  from: Date,
  toExclusive: Date,
): Promise<{
  newCustomers: number
  activeCustomers: number
  topByRevenue: Array<{ customerId: string; customerName: string; revenue: string }>
}> {
  const [newCustomers, activeCustomers, top] = await Promise.all([
    Customer.countDocuments({
      ...buildScopeMatch(scope),
      createdAt: { $gte: from, $lt: toExclusive },
    }),
    Contract.distinct('customerId', {
      ...buildScopeMatch(scope),
      status: CONTRACT_STATUSES.ACTIVE,
    }).then((ids) => ids.length),
    Invoice.aggregate([
      {
        $match: {
          ...buildScopeMatch(scope),
          status: DOC_STATUSES.POSTED,
          documentDate: { $gte: from, $lt: toExclusive },
        },
      },
      {
        $group: {
          _id: { customerId: '$customerId', name: '$customerDisplayName' },
          revenue: decimalSum('totalAmount'),
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]),
  ])
  return {
    newCustomers,
    activeCustomers,
    topByRevenue: top.map((row) => ({
      customerId: row._id.customerId.toString(),
      customerName: String(row._id.name),
      revenue: moneyFromAgg(row.revenue),
    })),
  }
}

export async function listContractsReport(
  scope: ScopeFilter,
  filters: {
    from?: Date
    toExclusive?: Date
    status?: string
    customerId?: string
    vehicleId?: string
    skip: number
    take: number
    sort: string
    order: 'asc' | 'desc'
  },
) {
  const match: Record<string, unknown> = { ...buildScopeMatch(scope) }
  if (filters.from || filters.toExclusive) {
    match.startsAt = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.toExclusive ? { $lt: filters.toExclusive } : {}),
    }
  }
  if (filters.status) match.status = filters.status
  if (filters.customerId) match.customerId = oid(filters.customerId)
  if (filters.vehicleId) match.currentVehicleId = oid(filters.vehicleId)
  const sortField = ['contractNumber', 'startsAt', 'endsAt', 'createdAt', 'status'].includes(filters.sort)
    ? filters.sort
    : 'createdAt'
  const [items, total] = await Promise.all([
    Contract.find(match)
      .sort({ [sortField]: filters.order === 'asc' ? 1 : -1 })
      .skip(filters.skip)
      .limit(filters.take)
      .lean(),
    Contract.countDocuments(match),
  ])

  const contractIds = items.map((c) => c._id)
  const outstanding =
    contractIds.length === 0
      ? []
      : await Invoice.aggregate([
          {
            $match: {
              ...buildScopeMatch(scope),
              status: DOC_STATUSES.POSTED,
              contractId: { $in: contractIds },
              outstandingAmount: { $nin: ['0', '0.0', '0.00'] },
            },
          },
          { $group: { _id: '$contractId', outstanding: decimalSum('outstandingAmount') } },
        ])
  const outstandingMap = new Map(outstanding.map((r) => [r._id.toString(), moneyFromAgg(r.outstanding)]))

  return {
    total,
    items: items.map((doc) => ({
      id: doc._id.toString(),
      contractNumber: String(doc.contractNumber),
      customerId: doc.customerId.toString(),
      customerName: doc.customerSnapshot?.displayName ? String(doc.customerSnapshot.displayName) : null,
      vehicleId: doc.currentVehicleId ? doc.currentVehicleId.toString() : null,
      vehiclePlate: doc.currentPlate ? String(doc.currentPlate) : null,
      startsAt: doc.startsAt as Date,
      endsAt: doc.endsAt as Date,
      status: String(doc.status),
      branchId: doc.branchId.toString(),
      currency: doc.currency ? String(doc.currency) : null,
      outstandingBalance: outstandingMap.get(doc._id.toString()) ?? '0.00',
      extended: Boolean(doc.originalEndsAt && doc.endsAt && (doc.endsAt as Date) > (doc.originalEndsAt as Date)),
    })),
  }
}

export async function listPaymentsReport(
  scope: ScopeFilter,
  filters: {
    from?: Date
    toExclusive?: Date
    status?: string
    method?: string
    customerId?: string
    skip: number
    take: number
    sort: string
    order: 'asc' | 'desc'
  },
) {
  const match: Record<string, unknown> = { ...buildScopeMatch(scope) }
  if (filters.from || filters.toExclusive) {
    match.paymentDate = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.toExclusive ? { $lt: filters.toExclusive } : {}),
    }
  }
  if (filters.status) match.status = filters.status
  if (filters.method) match.method = filters.method
  if (filters.customerId) match.customerId = oid(filters.customerId)
  const sortField = ['paymentNumber', 'paymentDate', 'amount', 'createdAt', 'status'].includes(filters.sort)
    ? filters.sort
    : 'paymentDate'
  const [items, total] = await Promise.all([
    Payment.find(match)
      .sort({ [sortField]: filters.order === 'asc' ? 1 : -1 })
      .skip(filters.skip)
      .limit(filters.take)
      .lean(),
    Payment.countDocuments(match),
  ])
  return {
    total,
    items: items.map((doc) => ({
      id: doc._id.toString(),
      paymentNumber: doc.paymentNumber ? String(doc.paymentNumber) : null,
      customerId: doc.customerId.toString(),
      customerName: String(doc.customerDisplayName),
      amount: String(doc.amount),
      currency: String(doc.currency),
      method: String(doc.method),
      status: String(doc.status),
      paymentDate: doc.paymentDate as Date,
      branchId: doc.branchId.toString(),
      legalEntityId: doc.legalEntityId.toString(),
    })),
  }
}

export async function listReceivablesAging(scope: ScopeFilter, asOf = new Date()) {
  const docs = await Invoice.find({
    ...buildScopeMatch(scope),
    status: DOC_STATUSES.POSTED,
    outstandingAmount: { $nin: ['0', '0.0', '0.00'] },
  })
    .sort({ dueDate: 1 })
    .limit(500)
    .lean()

  return docs.map((doc) => {
    const dueDate = doc.dueDate as Date
    const daysPastDue = Math.floor((asOf.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000))
    let bucket = 'current'
    if (daysPastDue >= 91) bucket = '90_plus'
    else if (daysPastDue >= 61) bucket = '61_90'
    else if (daysPastDue >= 31) bucket = '31_60'
    else if (daysPastDue >= 1) bucket = '1_30'
    return {
      invoiceId: doc._id.toString(),
      documentNumber: doc.documentNumber ? String(doc.documentNumber) : null,
      customerId: doc.customerId.toString(),
      customerName: String(doc.customerDisplayName),
      dueDate,
      outstandingAmount: String(doc.outstandingAmount),
      currency: String(doc.currency),
      daysPastDue: Math.max(0, daysPastDue),
      agingBucket: bucket,
      branchId: doc.branchId.toString(),
    }
  })
}

export async function receivablesSummaryByCustomer(scope: ScopeFilter, asOf = new Date()) {
  const rows = await listReceivablesAging(scope, asOf)
  const byCustomer = new Map<
    string,
    {
      customerId: string
      customerName: string
      outstanding: string
      overdue: string
      current: string
      buckets: Record<string, string>
    }
  >()

  for (const row of rows) {
    let entry = byCustomer.get(row.customerId)
    if (!entry) {
      entry = {
        customerId: row.customerId,
        customerName: row.customerName,
        outstanding: '0.00',
        overdue: '0.00',
        current: '0.00',
        buckets: { current: '0.00', '1_30': '0.00', '31_60': '0.00', '61_90': '0.00', '90_plus': '0.00' },
      }
      byCustomer.set(row.customerId, entry)
    }
    entry.outstanding = addMoney(entry.outstanding, row.outstandingAmount)
    entry.buckets[row.agingBucket] = addMoney(entry.buckets[row.agingBucket] ?? '0.00', row.outstandingAmount)
    if (row.agingBucket === 'current') entry.current = addMoney(entry.current, row.outstandingAmount)
    else entry.overdue = addMoney(entry.overdue, row.outstandingAmount)
  }
  return [...byCustomer.values()]
}

export async function listExpensesReport(
  scope: ScopeFilter,
  filters: {
    from?: Date
    toExclusive?: Date
    status?: string
    vendorId?: string
    vehicleId?: string
    category?: string
    skip: number
    take: number
  },
) {
  const match: Record<string, unknown> = { ...buildScopeMatch(scope) }
  if (filters.from || filters.toExclusive) {
    match.expenseDate = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.toExclusive ? { $lt: filters.toExclusive } : {}),
    }
  }
  if (filters.status) match.status = filters.status
  if (filters.vendorId) match.vendorId = oid(filters.vendorId)
  if (filters.vehicleId) match.vehicleId = oid(filters.vehicleId)
  if (filters.category) match.categoryCode = filters.category
  const [items, total] = await Promise.all([
    Expense.find(match).sort({ expenseDate: -1 }).skip(filters.skip).limit(filters.take).lean(),
    Expense.countDocuments(match),
  ])
  return {
    total,
    items: items.map((doc) => ({
      id: doc._id.toString(),
      expenseNumber: doc.documentNumber ? String(doc.documentNumber) : null,
      vendorId: doc.vendorId ? doc.vendorId.toString() : null,
      vendorName: doc.vendorName ? String(doc.vendorName) : null,
      category: doc.categoryCode ? String(doc.categoryCode) : null,
      vehicleId: doc.vehicleId ? doc.vehicleId.toString() : null,
      amount: String(doc.totalAmount ?? doc.amount ?? '0.00'),
      currency: doc.currency ? String(doc.currency) : null,
      expenseDate: doc.expenseDate as Date,
      branchId: doc.branchId.toString(),
      status: String(doc.status),
    })),
  }
}

export async function listMaintenanceReport(
  scope: ScopeFilter,
  filters: {
    from?: Date
    toExclusive?: Date
    vehicleId?: string
    vendorId?: string
    skip: number
    take: number
  },
) {
  const match: Record<string, unknown> = { ...buildScopeMatch(scope) }
  if (filters.from || filters.toExclusive) {
    match.scheduledAt = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.toExclusive ? { $lt: filters.toExclusive } : {}),
    }
  }
  if (filters.vehicleId) match.vehicleId = oid(filters.vehicleId)
  if (filters.vendorId) match.vendorId = oid(filters.vendorId)
  const [items, total] = await Promise.all([
    WorkOrder.find(match).sort({ scheduledAt: -1 }).skip(filters.skip).limit(filters.take).lean(),
    WorkOrder.countDocuments(match),
  ])
  return {
    total,
    items: items.map((doc) => {
      let downtimeHours: number | null = null
      if (doc.downtimeStartsAt && doc.downtimeEndsAt) {
        downtimeHours =
          Math.round(
            (((doc.downtimeEndsAt as Date).getTime() - (doc.downtimeStartsAt as Date).getTime()) /
              (60 * 60 * 1000)) *
              100,
          ) / 100
      }
      return {
        id: doc._id.toString(),
        workOrderNumber: doc.documentNumber ? String(doc.documentNumber) : null,
        vehicleId: doc.vehicleId ? doc.vehicleId.toString() : null,
        vehiclePlate: doc.vehiclePlate ? String(doc.vehiclePlate) : null,
        vendorId: doc.vendorId ? doc.vendorId.toString() : null,
        vendorName: doc.vendorName ? String(doc.vendorName) : null,
        maintenanceType: doc.serviceType ? String(doc.serviceType) : null,
        cost: doc.actualCost ? String(doc.actualCost) : doc.estimatedCost ? String(doc.estimatedCost) : null,
        currency: doc.currency ? String(doc.currency) : null,
        scheduledAt: doc.scheduledAt as Date | undefined,
        completedAt: doc.completedAt as Date | undefined,
        downtimeHours,
        branchId: doc.branchId.toString(),
        status: String(doc.status),
      }
    }),
  }
}

export async function listFinesTollsReport(
  scope: ScopeFilter,
  filters: {
    from?: Date
    toExclusive?: Date
    kind?: 'FINE' | 'TOLL'
    skip: number
    take: number
  },
) {
  const match: Record<string, unknown> = { ...buildScopeMatch(scope) }
  if (filters.from || filters.toExclusive) {
    match.eventAt = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.toExclusive ? { $lt: filters.toExclusive } : {}),
    }
  }

  const mapFine = (doc: Record<string, unknown> & { _id: { toString(): string }; eventAt: Date; branchId: { toString(): string }; amount: unknown; status: unknown }) => ({
    id: doc._id.toString(),
    kind: 'FINE' as const,
    number: doc.documentNumber ? String(doc.documentNumber) : null,
    vehicleId: doc.vehicleId ? String(doc.vehicleId) : null,
    vehiclePlate: doc.vehiclePlate ? String(doc.vehiclePlate) : null,
    eventAt: doc.eventAt,
    amount: String(doc.amount),
    currency: doc.currency ? String(doc.currency) : null,
    responsibility: doc.assignmentResolution ? String(doc.assignmentResolution) : null,
    customerId: doc.customerId ? String(doc.customerId) : null,
    customerName: doc.customerName ? String(doc.customerName) : null,
    recoveryStatus: String(doc.status),
    disputeStatus: null as string | null,
    branchId: doc.branchId.toString(),
  })

  const mapToll = (doc: Record<string, unknown> & { _id: { toString(): string }; eventAt: Date; branchId: { toString(): string }; amount: unknown; status: unknown }) => ({
    ...mapFine(doc),
    kind: 'TOLL' as const,
  })

  if (filters.kind === 'TOLL') {
    const [items, total] = await Promise.all([
      Toll.find(match).sort({ eventAt: -1 }).skip(filters.skip).limit(filters.take).lean(),
      Toll.countDocuments(match),
    ])
    return { total, items: items.map((doc) => mapToll(doc as never)) }
  }

  if (filters.kind === 'FINE') {
    const [items, total] = await Promise.all([
      Fine.find(match).sort({ eventAt: -1 }).skip(filters.skip).limit(filters.take).lean(),
      Fine.countDocuments(match),
    ])
    return { total, items: items.map((doc) => mapFine(doc as never)) }
  }

  const take = filters.skip + filters.take
  const [fines, tolls, fineTotal, tollTotal] = await Promise.all([
    Fine.find(match).sort({ eventAt: -1 }).limit(take).lean(),
    Toll.find(match).sort({ eventAt: -1 }).limit(take).lean(),
    Fine.countDocuments(match),
    Toll.countDocuments(match),
  ])
  const merged = [...fines.map((doc) => mapFine(doc as never)), ...tolls.map((doc) => mapToll(doc as never))].sort(
    (a, b) => b.eventAt.getTime() - a.eventAt.getTime(),
  )
  return {
    total: fineTotal + tollTotal,
    items: merged.slice(filters.skip, filters.skip + filters.take),
  }
}

export async function finesTollsMetrics(scope: ScopeFilter, from: Date, toExclusive: Date) {
  const match = {
    ...buildScopeMatch(scope),
    eventAt: { $gte: from, $lt: toExclusive },
  }
  const [fineAgg, tollAgg] = await Promise.all([
    Fine.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          amount: decimalSum('amount'),
          count: { $sum: 1 },
        },
      },
    ]),
    Toll.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          amount: decimalSum('amount'),
          count: { $sum: 1 },
        },
      },
    ]),
  ])

  const reduce = (rows: Array<{ _id: string; amount: unknown; count: number }>, statuses?: string[]) => {
    let amount = '0.00'
    let count = 0
    for (const row of rows) {
      if (statuses && !statuses.includes(String(row._id))) continue
      amount = addMoney(amount, moneyFromAgg(row.amount))
      count += row.count
    }
    return { amount, count }
  }

  const fines = reduce(fineAgg as Array<{ _id: string; amount: unknown; count: number }>)
  const tolls = reduce(tollAgg as Array<{ _id: string; amount: unknown; count: number }>)
  const all = [
    ...(fineAgg as Array<{ _id: string; amount: unknown; count: number }>),
    ...(tollAgg as Array<{ _id: string; amount: unknown; count: number }>),
  ]
  return {
    totalFines: fines,
    totalTolls: tolls,
    recovered: reduce(all, ['RECOVERED']),
    unrecovered: reduce(all, ['RECOVERY_PENDING', 'APPROVED', 'ASSIGNED']),
    disputed: reduce(all, ['DISPUTED']),
  }
}

export async function listRefundsReport(
  scope: ScopeFilter,
  filters: {
    from?: Date
    toExclusive?: Date
    status?: string
    skip: number
    take: number
  },
) {
  const match: Record<string, unknown> = { ...buildScopeMatch(scope) }
  if (filters.from || filters.toExclusive) {
    match.createdAt = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.toExclusive ? { $lt: filters.toExclusive } : {}),
    }
  }
  if (filters.status) match.status = filters.status
  const [items, total, byStatus] = await Promise.all([
    Refund.find(match).sort({ createdAt: -1 }).skip(filters.skip).limit(filters.take).lean(),
    Refund.countDocuments(match),
    Refund.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 }, amount: decimalSum('amount') } }]),
  ])
  return {
    total,
    metrics: Object.fromEntries(
      byStatus.map((row) => [
        String(row._id),
        { count: row.count as number, amount: moneyFromAgg(row.amount) },
      ]),
    ),
    items: items.map((doc) => ({
      id: doc._id.toString(),
      refundNumber: doc.documentNumber ? String(doc.documentNumber) : null,
      customerId: doc.customerId ? doc.customerId.toString() : null,
      customerName: doc.customerName ? String(doc.customerName) : null,
      source: doc.sourceKind ? String(doc.sourceKind) : null,
      amount: String(doc.amount),
      currency: doc.currency ? String(doc.currency) : null,
      status: String(doc.status),
      createdAt: doc.createdAt as Date,
      branchId: doc.branchId.toString(),
    })),
  }
}

export async function eInvoiceStatusReport(scope: ScopeFilter, from?: Date, toExclusive?: Date) {
  const match: Record<string, unknown> = { ...buildScopeMatch(scope) }
  if (from || toExclusive) {
    match.issueDate = {
      ...(from ? { $gte: from } : {}),
      ...(toExclusive ? { $lt: toExclusive } : {}),
    }
  }
  const rows = await EInvoiceDocument.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        amount: decimalSum('totalAmount'),
      },
    },
  ])
  return rows.map((row) => ({
    status: String(row._id),
    count: row.count as number,
    amount: moneyFromAgg(row.amount),
  }))
}

export async function profitabilityFoundation(
  scope: ScopeFilter,
  from: Date,
  toExclusive: Date,
  dimension: 'branch' | 'customer' | 'vehicle' | 'vehicle_type',
) {
  if (dimension === 'branch' || dimension === 'customer') {
    const groupId = dimension === 'branch' ? '$branchId' : '$customerId'
    const nameField = dimension === 'customer' ? '$customerDisplayName' : null
    const rows = await Invoice.aggregate([
      {
        $match: {
          ...buildScopeMatch(scope),
          status: DOC_STATUSES.POSTED,
          documentDate: { $gte: from, $lt: toExclusive },
        },
      },
      {
        $group: {
          _id: groupId,
          name: nameField ? { $first: nameField } : { $first: { $toString: groupId } },
          revenue: decimalSum('totalAmount'),
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 50 },
    ])
    return rows.map((row) => ({
      dimensionId: row._id?.toString?.() ?? String(row._id),
      label: row.name ? String(row.name) : String(row._id),
      revenue: moneyFromAgg(row.revenue),
      directCosts: null as string | null,
      grossContribution: null as string | null,
      costsAvailable: false,
    }))
  }

  // vehicle / vehicle_type — revenue via contract linkage; costs unavailable unless expense posted
  return []
}

export async function countNewCustomers(scope: ScopeFilter, from: Date, toExclusive: Date) {
  return Customer.countDocuments({
    ...buildScopeMatch(scope),
    createdAt: { $gte: from, $lt: toExclusive },
  })
}
