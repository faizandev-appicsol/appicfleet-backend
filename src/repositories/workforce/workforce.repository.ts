import type { FilterQuery } from 'mongoose'
import {
  AttendanceCorrectionModel,
  AttendanceExceptionModel,
  AttendanceImportBatchModel,
  AttendanceOvertimeModel,
  AttendanceRecordModel,
  EmployeeLeaveBalanceModel,
  EmployeeScheduleAssignmentModel,
  HolidayModel,
  LeaveApprovalModel,
  LeaveBalanceTransactionModel,
  LeavePolicyModel,
  LeaveRequestModel,
  LeaveTypeModel,
  ScheduleHistoryModel,
  ShiftDefinitionModel,
  WorkScheduleModel,
  WorkforceNotificationIntentModel,
  WorkforceOutboxEventModel,
} from '../../models/workforce.model.js'
import { toObjectId } from '../object-id.js'

type LeanDoc = Record<string, unknown> & { _id: { toString(): string } }

function sid(value: unknown): string {
  return String(value)
}

function oid(value?: string | null) {
  return value ? toObjectId(value) : undefined
}

function mapBase(doc: LeanDoc) {
  return {
    id: sid(doc._id),
    organizationId: sid(doc.organizationId),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}

export type WorkScheduleRecord = ReturnType<typeof mapSchedule>
export type ShiftDefinitionRecord = ReturnType<typeof mapShift>
export type EmployeeScheduleAssignmentRecord = ReturnType<typeof mapAssignment>
export type AttendanceRecord = ReturnType<typeof mapAttendance>
export type AttendanceCorrectionRecord = ReturnType<typeof mapCorrection>
export type AttendanceExceptionRecord = ReturnType<typeof mapException>
export type LeaveTypeRecord = ReturnType<typeof mapLeaveType>
export type LeavePolicyRecord = ReturnType<typeof mapLeavePolicy>
export type LeaveBalanceRecord = ReturnType<typeof mapLeaveBalance>
export type LeaveRequestRecord = ReturnType<typeof mapLeaveRequest>
export type HolidayRecord = ReturnType<typeof mapHoliday>
export type AttendanceOvertimeRecord = ReturnType<typeof mapOvertime>

function mapSchedule(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: doc.legalEntityId ? sid(doc.legalEntityId) : undefined,
    code: sid(doc.code),
    name: sid(doc.name),
    nameAr: doc.nameAr ? sid(doc.nameAr) : undefined,
    description: doc.description ? sid(doc.description) : undefined,
    timezone: sid(doc.timezone),
    workingDays: (doc.workingDays as string[]) ?? [],
    startTime: sid(doc.startTime),
    endTime: sid(doc.endTime),
    breaks: (doc.breaks as Array<{ startTime: string; endTime: string; type?: string }>) ?? [],
    graceMinutes: Number(doc.graceMinutes ?? 15),
    status: sid(doc.status),
    createdBy: sid(doc.createdBy),
    updatedBy: doc.updatedBy ? sid(doc.updatedBy) : undefined,
  }
}

function mapShift(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: doc.legalEntityId ? sid(doc.legalEntityId) : undefined,
    code: sid(doc.code),
    name: sid(doc.name),
    nameAr: doc.nameAr ? sid(doc.nameAr) : undefined,
    description: doc.description ? sid(doc.description) : undefined,
    timezone: sid(doc.timezone),
    startTime: sid(doc.startTime),
    endTime: sid(doc.endTime),
    breaks: (doc.breaks as Array<{ startTime: string; endTime: string; type?: string }>) ?? [],
    graceMinutes: Number(doc.graceMinutes ?? 15),
    crossesMidnight: Boolean(doc.crossesMidnight),
    status: sid(doc.status),
    createdBy: sid(doc.createdBy),
    updatedBy: doc.updatedBy ? sid(doc.updatedBy) : undefined,
  }
}

function mapAssignment(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeId: sid(doc.employeeId),
    workScheduleId: doc.workScheduleId ? sid(doc.workScheduleId) : undefined,
    shiftDefinitionId: doc.shiftDefinitionId ? sid(doc.shiftDefinitionId) : undefined,
    effectiveFrom: doc.effectiveFrom as Date,
    effectiveTo: doc.effectiveTo as Date | undefined,
    status: sid(doc.status),
    reason: doc.reason ? sid(doc.reason) : undefined,
    previousAssignmentId: doc.previousAssignmentId ? sid(doc.previousAssignmentId) : undefined,
    createdBy: sid(doc.createdBy),
    updatedBy: doc.updatedBy ? sid(doc.updatedBy) : undefined,
  }
}

function mapAttendance(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeId: sid(doc.employeeId),
    businessDate: sid(doc.businessDate),
    timezone: sid(doc.timezone),
    workScheduleId: doc.workScheduleId ? sid(doc.workScheduleId) : undefined,
    shiftDefinitionId: doc.shiftDefinitionId ? sid(doc.shiftDefinitionId) : undefined,
    scheduleAssignmentId: doc.scheduleAssignmentId ? sid(doc.scheduleAssignmentId) : undefined,
    scheduledStart: doc.scheduledStart as Date | undefined,
    scheduledEnd: doc.scheduledEnd as Date | undefined,
    clockInAt: doc.clockInAt as Date | undefined,
    clockOutAt: doc.clockOutAt as Date | undefined,
    breaks:
      (doc.breaks as Array<{
        startAt: Date
        endAt: Date
        durationMinutes: number
        type?: string
      }>) ?? [],
    scheduledDurationMinutes: Number(doc.scheduledDurationMinutes ?? 0),
    breakDurationMinutes: Number(doc.breakDurationMinutes ?? 0),
    workedDurationMinutes: Number(doc.workedDurationMinutes ?? 0),
    lateDurationMinutes: Number(doc.lateDurationMinutes ?? 0),
    earlyLeaveDurationMinutes: Number(doc.earlyLeaveDurationMinutes ?? 0),
    overtimeDurationMinutes: Number(doc.overtimeDurationMinutes ?? 0),
    status: sid(doc.status),
    source: sid(doc.source),
    notes: doc.notes ? sid(doc.notes) : undefined,
    leaveRequestId: doc.leaveRequestId ? sid(doc.leaveRequestId) : undefined,
    holidayId: doc.holidayId ? sid(doc.holidayId) : undefined,
    externalReference: doc.externalReference ? sid(doc.externalReference) : undefined,
    createdBy: doc.createdBy ? sid(doc.createdBy) : undefined,
    updatedBy: doc.updatedBy ? sid(doc.updatedBy) : undefined,
  }
}

function mapCorrection(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeId: sid(doc.employeeId),
    attendanceRecordId: sid(doc.attendanceRecordId),
    originalClockInAt: doc.originalClockInAt as Date | undefined,
    originalClockOutAt: doc.originalClockOutAt as Date | undefined,
    originalStatus: doc.originalStatus ? sid(doc.originalStatus) : undefined,
    requestedClockInAt: doc.requestedClockInAt as Date | undefined,
    requestedClockOutAt: doc.requestedClockOutAt as Date | undefined,
    requestedStatus: doc.requestedStatus ? sid(doc.requestedStatus) : undefined,
    reason: sid(doc.reason),
    status: sid(doc.status),
    requestedBy: sid(doc.requestedBy),
    reviewedBy: doc.reviewedBy ? sid(doc.reviewedBy) : undefined,
    reviewedAt: doc.reviewedAt as Date | undefined,
    reviewNotes: doc.reviewNotes ? sid(doc.reviewNotes) : undefined,
  }
}

function mapException(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeId: sid(doc.employeeId),
    attendanceRecordId: doc.attendanceRecordId ? sid(doc.attendanceRecordId) : undefined,
    businessDate: sid(doc.businessDate),
    code: sid(doc.code),
    message: sid(doc.message),
    resolved: Boolean(doc.resolved),
    resolvedAt: doc.resolvedAt as Date | undefined,
    resolvedBy: doc.resolvedBy ? sid(doc.resolvedBy) : undefined,
  }
}

function mapLeaveType(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: doc.legalEntityId ? sid(doc.legalEntityId) : undefined,
    code: sid(doc.code),
    name: sid(doc.name),
    nameAr: doc.nameAr ? sid(doc.nameAr) : undefined,
    description: doc.description ? sid(doc.description) : undefined,
    paid: Boolean(doc.paid),
    requiresApproval: Boolean(doc.requiresApproval),
    requiresDocument: Boolean(doc.requiresDocument),
    status: sid(doc.status),
    createdBy: sid(doc.createdBy),
  }
}

function mapLeavePolicy(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: doc.legalEntityId ? sid(doc.legalEntityId) : undefined,
    leaveTypeId: sid(doc.leaveTypeId),
    name: sid(doc.name),
    accrualMethod: sid(doc.accrualMethod),
    annualEntitlementDays: sid(doc.annualEntitlementDays),
    carryForwardAllowed: Boolean(doc.carryForwardAllowed),
    maxCarryForwardDays: doc.maxCarryForwardDays ? sid(doc.maxCarryForwardDays) : undefined,
    expiryMonths: doc.expiryMonths != null ? Number(doc.expiryMonths) : undefined,
    effectiveFrom: doc.effectiveFrom as Date,
    effectiveTo: doc.effectiveTo as Date | undefined,
    status: sid(doc.status),
    createdBy: sid(doc.createdBy),
  }
}

function mapLeaveBalance(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeId: sid(doc.employeeId),
    leaveTypeId: sid(doc.leaveTypeId),
    leavePolicyId: doc.leavePolicyId ? sid(doc.leavePolicyId) : undefined,
    periodYear: Number(doc.periodYear),
    openingDays: sid(doc.openingDays),
    accruedDays: sid(doc.accruedDays),
    usedDays: sid(doc.usedDays),
    pendingDays: sid(doc.pendingDays),
    adjustedDays: sid(doc.adjustedDays),
    availableDays: sid(doc.availableDays),
    version: Number(doc.version ?? 1),
  }
}

function mapLeaveRequest(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeId: sid(doc.employeeId),
    leaveTypeId: sid(doc.leaveTypeId),
    startDate: sid(doc.startDate),
    endDate: sid(doc.endDate),
    dayPart: sid(doc.dayPart),
    partialHours: doc.partialHours ? sid(doc.partialHours) : undefined,
    daysRequested: sid(doc.daysRequested),
    reason: doc.reason ? sid(doc.reason) : undefined,
    documentStorageKey: doc.documentStorageKey ? sid(doc.documentStorageKey) : undefined,
    status: sid(doc.status),
    submittedAt: doc.submittedAt as Date | undefined,
    reviewedBy: doc.reviewedBy ? sid(doc.reviewedBy) : undefined,
    reviewedAt: doc.reviewedAt as Date | undefined,
    reviewNotes: doc.reviewNotes ? sid(doc.reviewNotes) : undefined,
    cancelledAt: doc.cancelledAt as Date | undefined,
    cancelledBy: doc.cancelledBy ? sid(doc.cancelledBy) : undefined,
    idempotencyKey: doc.idempotencyKey ? sid(doc.idempotencyKey) : undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapHoliday(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: doc.legalEntityId ? sid(doc.legalEntityId) : undefined,
    branchId: doc.branchId ? sid(doc.branchId) : undefined,
    name: sid(doc.name),
    nameAr: doc.nameAr ? sid(doc.nameAr) : undefined,
    date: sid(doc.date),
    country: doc.country ? sid(doc.country) : undefined,
    recurring: Boolean(doc.recurring),
    status: sid(doc.status),
    createdBy: sid(doc.createdBy),
  }
}

function mapOvertime(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeId: sid(doc.employeeId),
    attendanceRecordId: doc.attendanceRecordId ? sid(doc.attendanceRecordId) : undefined,
    workDate: sid(doc.workDate),
    minutes: Number(doc.minutes),
    hours: sid(doc.hours),
    reason: doc.reason ? sid(doc.reason) : undefined,
    status: sid(doc.status),
    payrollOvertimeId: doc.payrollOvertimeId ? sid(doc.payrollOvertimeId) : undefined,
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    createdBy: sid(doc.createdBy),
  }
}

function isDuplicateKey(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000,
  )
}

// ——— Schedules / shifts ———

export async function insertWorkSchedule(data: Record<string, unknown>) {
  const doc = await WorkScheduleModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(data.legalEntityId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapSchedule(doc.toObject() as LeanDoc)
}

export async function findWorkScheduleById(id: string) {
  const doc = await WorkScheduleModel.findById(oid(id)).lean()
  return doc ? mapSchedule(doc as LeanDoc) : null
}

export async function updateWorkSchedule(id: string, patch: Record<string, unknown>) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await WorkScheduleModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapSchedule(doc as LeanDoc) : null
}

export async function listWorkSchedules(filter: {
  organizationId: string
  status?: string
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof WorkScheduleModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.status) query.status = filter.status
  const [items, total] = await Promise.all([
    WorkScheduleModel.find(query).sort({ name: 1 }).skip(filter.skip).limit(filter.limit).lean(),
    WorkScheduleModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapSchedule), total }
}

export async function insertShiftDefinition(data: Record<string, unknown>) {
  const doc = await ShiftDefinitionModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(data.legalEntityId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapShift(doc.toObject() as LeanDoc)
}

export async function findShiftById(id: string) {
  const doc = await ShiftDefinitionModel.findById(oid(id)).lean()
  return doc ? mapShift(doc as LeanDoc) : null
}

export async function updateShift(id: string, patch: Record<string, unknown>) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await ShiftDefinitionModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapShift(doc as LeanDoc) : null
}

export async function listShifts(filter: {
  organizationId: string
  status?: string
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof ShiftDefinitionModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.status) query.status = filter.status
  const [items, total] = await Promise.all([
    ShiftDefinitionModel.find(query).sort({ name: 1 }).skip(filter.skip).limit(filter.limit).lean(),
    ShiftDefinitionModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapShift), total }
}

export async function insertScheduleAssignment(data: Record<string, unknown>) {
  const doc = await EmployeeScheduleAssignmentModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    employeeId: oid(String(data.employeeId)),
    workScheduleId: oid(data.workScheduleId as string | undefined),
    shiftDefinitionId: oid(data.shiftDefinitionId as string | undefined),
    previousAssignmentId: oid(data.previousAssignmentId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapAssignment(doc.toObject() as LeanDoc)
}

export async function findAssignmentById(id: string) {
  const doc = await EmployeeScheduleAssignmentModel.findById(oid(id)).lean()
  return doc ? mapAssignment(doc as LeanDoc) : null
}

export async function updateAssignment(id: string, patch: Record<string, unknown>) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await EmployeeScheduleAssignmentModel.findByIdAndUpdate(
    oid(id),
    { $set: patch },
    { new: true },
  ).lean()
  return doc ? mapAssignment(doc as LeanDoc) : null
}

export async function findActiveAssignmentForDate(
  organizationId: string,
  employeeId: string,
  at: Date,
) {
  const doc = await EmployeeScheduleAssignmentModel.findOne({
    organizationId: oid(organizationId),
    employeeId: oid(employeeId),
    status: 'ACTIVE',
    effectiveFrom: { $lte: at },
    $or: [{ effectiveTo: null }, { effectiveTo: { $exists: false } }, { effectiveTo: { $gte: at } }],
  })
    .sort({ effectiveFrom: -1 })
    .lean()
  return doc ? mapAssignment(doc as LeanDoc) : null
}

export async function listAssignments(filter: {
  organizationId: string
  employeeId?: string
  branchIds?: string[]
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof EmployeeScheduleAssignmentModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  const [items, total] = await Promise.all([
    EmployeeScheduleAssignmentModel.find(query)
      .sort({ effectiveFrom: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    EmployeeScheduleAssignmentModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapAssignment), total }
}

export async function insertScheduleHistory(data: Record<string, unknown>) {
  await ScheduleHistoryModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    employeeId: oid(String(data.employeeId)),
    previousAssignmentId: oid(data.previousAssignmentId as string | undefined),
    newAssignmentId: oid(String(data.newAssignmentId)),
    previousWorkScheduleId: oid(data.previousWorkScheduleId as string | undefined),
    previousShiftDefinitionId: oid(data.previousShiftDefinitionId as string | undefined),
    newWorkScheduleId: oid(data.newWorkScheduleId as string | undefined),
    newShiftDefinitionId: oid(data.newShiftDefinitionId as string | undefined),
    changedBy: oid(String(data.changedBy)),
  })
}

// ——— Attendance ———

export async function insertAttendance(data: Record<string, unknown>) {
  try {
    const doc = await AttendanceRecordModel.create({
      ...data,
      organizationId: oid(String(data.organizationId)),
      legalEntityId: oid(String(data.legalEntityId)),
      branchId: oid(String(data.branchId)),
      employeeId: oid(String(data.employeeId)),
      workScheduleId: oid(data.workScheduleId as string | undefined),
      shiftDefinitionId: oid(data.shiftDefinitionId as string | undefined),
      scheduleAssignmentId: oid(data.scheduleAssignmentId as string | undefined),
      leaveRequestId: oid(data.leaveRequestId as string | undefined),
      holidayId: oid(data.holidayId as string | undefined),
      createdBy: oid(data.createdBy as string | undefined),
    })
    return mapAttendance(doc.toObject() as LeanDoc)
  } catch (error) {
    if (isDuplicateKey(error)) return null
    throw error
  }
}

export async function findAttendanceById(id: string) {
  const doc = await AttendanceRecordModel.findById(oid(id)).lean()
  return doc ? mapAttendance(doc as LeanDoc) : null
}

export async function findAttendanceByEmployeeDate(
  organizationId: string,
  employeeId: string,
  businessDate: string,
) {
  const doc = await AttendanceRecordModel.findOne({
    organizationId: oid(organizationId),
    employeeId: oid(employeeId),
    businessDate,
  }).lean()
  return doc ? mapAttendance(doc as LeanDoc) : null
}

export async function updateAttendance(id: string, patch: Record<string, unknown>, expectedVersion?: never) {
  void expectedVersion
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await AttendanceRecordModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapAttendance(doc as LeanDoc) : null
}

/** Atomic clock-in: only succeeds when clockInAt is still unset. */
export async function atomicClockIn(
  id: string,
  patch: Record<string, unknown>,
): Promise<AttendanceRecord | null> {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await AttendanceRecordModel.findOneAndUpdate(
    {
      _id: oid(id),
      $or: [{ clockInAt: null }, { clockInAt: { $exists: false } }],
    },
    { $set: patch },
    { new: true },
  ).lean()
  return doc ? mapAttendance(doc as LeanDoc) : null
}

/** Atomic clock-out: requires clock-in and unset clock-out. */
export async function atomicClockOut(
  id: string,
  patch: Record<string, unknown>,
): Promise<AttendanceRecord | null> {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await AttendanceRecordModel.findOneAndUpdate(
    {
      _id: oid(id),
      clockInAt: { $exists: true, $ne: null },
      $or: [{ clockOutAt: null }, { clockOutAt: { $exists: false } }],
    },
    { $set: patch },
    { new: true },
  ).lean()
  return doc ? mapAttendance(doc as LeanDoc) : null
}

export async function listAttendance(filter: {
  organizationId: string
  employeeId?: string
  branchIds?: string[]
  status?: string
  source?: string
  fromDate?: string
  toDate?: string
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof AttendanceRecordModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  if (filter.status) query.status = filter.status
  if (filter.source) query.source = filter.source
  if (filter.fromDate || filter.toDate) {
    query.businessDate = {}
    if (filter.fromDate) (query.businessDate as Record<string, string>).$gte = filter.fromDate
    if (filter.toDate) (query.businessDate as Record<string, string>).$lte = filter.toDate
  }
  const [items, total] = await Promise.all([
    AttendanceRecordModel.find(query)
      .sort({ businessDate: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    AttendanceRecordModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapAttendance), total }
}

export async function countAttendanceByStatus(
  organizationId: string,
  businessDate: string,
  branchIds?: string[],
) {
  const match: Record<string, unknown> = {
    organizationId: oid(organizationId),
    businessDate,
  }
  if (branchIds?.length) match.branchId = { $in: branchIds.map((id) => oid(id)) }
  const rows = await AttendanceRecordModel.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  const result: Record<string, number> = {}
  for (const row of rows) result[String(row._id)] = Number(row.count)
  return result
}

export async function insertCorrection(data: Record<string, unknown>) {
  const doc = await AttendanceCorrectionModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    employeeId: oid(String(data.employeeId)),
    attendanceRecordId: oid(String(data.attendanceRecordId)),
    requestedBy: oid(String(data.requestedBy)),
  })
  return mapCorrection(doc.toObject() as LeanDoc)
}

export async function findCorrectionById(id: string) {
  const doc = await AttendanceCorrectionModel.findById(oid(id)).lean()
  return doc ? mapCorrection(doc as LeanDoc) : null
}

export async function updateCorrection(id: string, patch: Record<string, unknown>) {
  if (patch.reviewedBy) patch.reviewedBy = oid(String(patch.reviewedBy))
  const doc = await AttendanceCorrectionModel.findOneAndUpdate(
    { _id: oid(id), status: { $in: ['REQUESTED', 'UNDER_REVIEW'] } },
    { $set: patch },
    { new: true },
  ).lean()
  return doc ? mapCorrection(doc as LeanDoc) : null
}

export async function listCorrections(filter: {
  organizationId: string
  status?: string
  employeeId?: string
  branchIds?: string[]
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof AttendanceCorrectionModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.status) query.status = filter.status
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  const [items, total] = await Promise.all([
    AttendanceCorrectionModel.find(query)
      .sort({ createdAt: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    AttendanceCorrectionModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapCorrection), total }
}

export async function insertException(data: Record<string, unknown>) {
  const doc = await AttendanceExceptionModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    employeeId: oid(String(data.employeeId)),
    attendanceRecordId: oid(data.attendanceRecordId as string | undefined),
  })
  return mapException(doc.toObject() as LeanDoc)
}

export async function listExceptions(filter: {
  organizationId: string
  resolved?: boolean
  branchIds?: string[]
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof AttendanceExceptionModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.resolved !== undefined) query.resolved = filter.resolved
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  const [items, total] = await Promise.all([
    AttendanceExceptionModel.find(query)
      .sort({ businessDate: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    AttendanceExceptionModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapException), total }
}

// ——— Leave ———

export async function insertLeaveType(data: Record<string, unknown>) {
  const doc = await LeaveTypeModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(data.legalEntityId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapLeaveType(doc.toObject() as LeanDoc)
}

export async function findLeaveTypeById(id: string) {
  const doc = await LeaveTypeModel.findById(oid(id)).lean()
  return doc ? mapLeaveType(doc as LeanDoc) : null
}

export async function updateLeaveType(id: string, patch: Record<string, unknown>) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await LeaveTypeModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapLeaveType(doc as LeanDoc) : null
}

export async function listLeaveTypes(filter: {
  organizationId: string
  status?: string
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof LeaveTypeModel> = { organizationId: oid(filter.organizationId) }
  if (filter.status) query.status = filter.status
  const [items, total] = await Promise.all([
    LeaveTypeModel.find(query).sort({ name: 1 }).skip(filter.skip).limit(filter.limit).lean(),
    LeaveTypeModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapLeaveType), total }
}

export async function insertLeavePolicy(data: Record<string, unknown>) {
  const doc = await LeavePolicyModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(data.legalEntityId as string | undefined),
    leaveTypeId: oid(String(data.leaveTypeId)),
    createdBy: oid(String(data.createdBy)),
  })
  return mapLeavePolicy(doc.toObject() as LeanDoc)
}

export async function findLeavePolicyById(id: string) {
  const doc = await LeavePolicyModel.findById(oid(id)).lean()
  return doc ? mapLeavePolicy(doc as LeanDoc) : null
}

export async function listLeavePolicies(filter: {
  organizationId: string
  leaveTypeId?: string
  status?: string
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof LeavePolicyModel> = { organizationId: oid(filter.organizationId) }
  if (filter.leaveTypeId) query.leaveTypeId = oid(filter.leaveTypeId)
  if (filter.status) query.status = filter.status
  const [items, total] = await Promise.all([
    LeavePolicyModel.find(query)
      .sort({ effectiveFrom: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    LeavePolicyModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapLeavePolicy), total }
}

export async function findLeaveBalance(
  organizationId: string,
  employeeId: string,
  leaveTypeId: string,
  periodYear: number,
) {
  const doc = await EmployeeLeaveBalanceModel.findOne({
    organizationId: oid(organizationId),
    employeeId: oid(employeeId),
    leaveTypeId: oid(leaveTypeId),
    periodYear,
  }).lean()
  return doc ? mapLeaveBalance(doc as LeanDoc) : null
}

export async function insertLeaveBalance(data: Record<string, unknown>) {
  try {
    const doc = await EmployeeLeaveBalanceModel.create({
      ...data,
      organizationId: oid(String(data.organizationId)),
      legalEntityId: oid(String(data.legalEntityId)),
      branchId: oid(String(data.branchId)),
      employeeId: oid(String(data.employeeId)),
      leaveTypeId: oid(String(data.leaveTypeId)),
      leavePolicyId: oid(data.leavePolicyId as string | undefined),
    })
    return mapLeaveBalance(doc.toObject() as LeanDoc)
  } catch (error) {
    if (isDuplicateKey(error)) {
      return findLeaveBalance(
        String(data.organizationId),
        String(data.employeeId),
        String(data.leaveTypeId),
        Number(data.periodYear),
      )
    }
    throw error
  }
}

export async function updateLeaveBalanceOptimistic(
  id: string,
  expectedVersion: number,
  patch: Record<string, unknown>,
) {
  const doc = await EmployeeLeaveBalanceModel.findOneAndUpdate(
    { _id: oid(id), version: expectedVersion },
    { $set: { ...patch, version: expectedVersion + 1 } },
    { new: true },
  ).lean()
  return doc ? mapLeaveBalance(doc as LeanDoc) : null
}

export async function listLeaveBalances(filter: {
  organizationId: string
  employeeId?: string
  branchIds?: string[]
  periodYear?: number
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof EmployeeLeaveBalanceModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  if (filter.periodYear) query.periodYear = filter.periodYear
  const [items, total] = await Promise.all([
    EmployeeLeaveBalanceModel.find(query)
      .sort({ periodYear: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    EmployeeLeaveBalanceModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapLeaveBalance), total }
}

export async function insertLeaveBalanceTx(data: Record<string, unknown>) {
  try {
    const doc = await LeaveBalanceTransactionModel.create({
      ...data,
      organizationId: oid(String(data.organizationId)),
      employeeId: oid(String(data.employeeId)),
      leaveTypeId: oid(String(data.leaveTypeId)),
      leaveBalanceId: oid(String(data.leaveBalanceId)),
      leaveRequestId: oid(data.leaveRequestId as string | undefined),
      createdBy: oid(data.createdBy as string | undefined),
    })
    return {
      id: sid(doc._id),
      idempotencyKey: sid(doc.idempotencyKey),
      type: sid(doc.type),
      days: sid(doc.days),
      balanceAfter: sid(doc.balanceAfter),
    }
  } catch (error) {
    if (isDuplicateKey(error)) return null
    throw error
  }
}

export async function insertLeaveRequest(data: Record<string, unknown>) {
  try {
    const doc = await LeaveRequestModel.create({
      ...data,
      organizationId: oid(String(data.organizationId)),
      legalEntityId: oid(String(data.legalEntityId)),
      branchId: oid(String(data.branchId)),
      employeeId: oid(String(data.employeeId)),
      leaveTypeId: oid(String(data.leaveTypeId)),
      createdBy: oid(String(data.createdBy)),
    })
    return mapLeaveRequest(doc.toObject() as LeanDoc)
  } catch (error) {
    if (isDuplicateKey(error) && data.idempotencyKey) {
      const existing = await LeaveRequestModel.findOne({
        organizationId: oid(String(data.organizationId)),
        idempotencyKey: data.idempotencyKey,
      }).lean()
      return existing ? mapLeaveRequest(existing as LeanDoc) : null
    }
    throw error
  }
}

export async function findLeaveRequestById(id: string) {
  const doc = await LeaveRequestModel.findById(oid(id)).lean()
  return doc ? mapLeaveRequest(doc as LeanDoc) : null
}

export async function updateLeaveRequest(
  id: string,
  patch: Record<string, unknown>,
  fromStatuses?: string[],
) {
  if (patch.reviewedBy) patch.reviewedBy = oid(String(patch.reviewedBy))
  if (patch.cancelledBy) patch.cancelledBy = oid(String(patch.cancelledBy))
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const filter: FilterQuery<typeof LeaveRequestModel> = { _id: oid(id) }
  if (fromStatuses?.length) filter.status = { $in: fromStatuses }
  const doc = await LeaveRequestModel.findOneAndUpdate(filter, { $set: patch }, { new: true }).lean()
  return doc ? mapLeaveRequest(doc as LeanDoc) : null
}

export async function listLeaveRequests(filter: {
  organizationId: string
  employeeId?: string
  leaveTypeId?: string
  status?: string
  branchIds?: string[]
  fromDate?: string
  toDate?: string
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof LeaveRequestModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.leaveTypeId) query.leaveTypeId = oid(filter.leaveTypeId)
  if (filter.status) query.status = filter.status
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  if (filter.fromDate || filter.toDate) {
    query.startDate = {}
    if (filter.fromDate) (query.startDate as Record<string, string>).$lte = filter.toDate ?? filter.fromDate
    if (filter.toDate) query.endDate = { $gte: filter.fromDate ?? filter.toDate }
  }
  const [items, total] = await Promise.all([
    LeaveRequestModel.find(query)
      .sort({ startDate: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    LeaveRequestModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapLeaveRequest), total }
}

export async function findApprovedLeaveCoveringDate(
  organizationId: string,
  employeeId: string,
  ymd: string,
) {
  const doc = await LeaveRequestModel.findOne({
    organizationId: oid(organizationId),
    employeeId: oid(employeeId),
    status: 'APPROVED',
    startDate: { $lte: ymd },
    endDate: { $gte: ymd },
  }).lean()
  return doc ? mapLeaveRequest(doc as LeanDoc) : null
}

export async function insertLeaveApproval(data: Record<string, unknown>) {
  await LeaveApprovalModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    leaveRequestId: oid(String(data.leaveRequestId)),
    actorUserId: oid(String(data.actorUserId)),
  })
}

// ——— Holidays / OT / intents ———

export async function insertHoliday(data: Record<string, unknown>) {
  const doc = await HolidayModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(data.legalEntityId as string | undefined),
    branchId: oid(data.branchId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapHoliday(doc.toObject() as LeanDoc)
}

export async function findHolidayById(id: string) {
  const doc = await HolidayModel.findById(oid(id)).lean()
  return doc ? mapHoliday(doc as LeanDoc) : null
}

export async function updateHoliday(id: string, patch: Record<string, unknown>) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await HolidayModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapHoliday(doc as LeanDoc) : null
}

export async function listHolidays(filter: {
  organizationId: string
  fromDate?: string
  toDate?: string
  branchId?: string
  status?: string
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof HolidayModel> = { organizationId: oid(filter.organizationId) }
  if (filter.status) query.status = filter.status
  if (filter.branchId) {
    query.$or = [{ branchId: oid(filter.branchId) }, { branchId: null }, { branchId: { $exists: false } }]
  }
  if (filter.fromDate || filter.toDate) {
    query.date = {}
    if (filter.fromDate) (query.date as Record<string, string>).$gte = filter.fromDate
    if (filter.toDate) (query.date as Record<string, string>).$lte = filter.toDate
  }
  const [items, total] = await Promise.all([
    HolidayModel.find(query).sort({ date: 1 }).skip(filter.skip).limit(filter.limit).lean(),
    HolidayModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapHoliday), total }
}

export async function findHolidayForDate(
  organizationId: string,
  ymd: string,
  branchId?: string,
  legalEntityId?: string,
) {
  const or: Record<string, unknown>[] = [
    { branchId: null },
    { branchId: { $exists: false } },
  ]
  if (branchId) or.unshift({ branchId: oid(branchId) })
  const query: FilterQuery<typeof HolidayModel> = {
    organizationId: oid(organizationId),
    date: ymd,
    status: 'ACTIVE',
    $or: or,
  }
  if (legalEntityId) {
    query.$and = [
      {
        $or: [
          { legalEntityId: oid(legalEntityId) },
          { legalEntityId: null },
          { legalEntityId: { $exists: false } },
        ],
      },
    ]
  }
  const doc = await HolidayModel.findOne(query).lean()
  return doc ? mapHoliday(doc as LeanDoc) : null
}

export async function insertAttendanceOvertime(data: Record<string, unknown>) {
  const doc = await AttendanceOvertimeModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    employeeId: oid(String(data.employeeId)),
    attendanceRecordId: oid(data.attendanceRecordId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapOvertime(doc.toObject() as LeanDoc)
}

export async function findAttendanceOvertimeById(id: string) {
  const doc = await AttendanceOvertimeModel.findById(oid(id)).lean()
  return doc ? mapOvertime(doc as LeanDoc) : null
}

export async function updateAttendanceOvertime(
  id: string,
  patch: Record<string, unknown>,
  fromStatuses?: string[],
) {
  if (patch.approvedBy) patch.approvedBy = oid(String(patch.approvedBy))
  if (patch.payrollOvertimeId) patch.payrollOvertimeId = oid(String(patch.payrollOvertimeId))
  const filter: FilterQuery<typeof AttendanceOvertimeModel> = { _id: oid(id) }
  if (fromStatuses?.length) filter.status = { $in: fromStatuses }
  const doc = await AttendanceOvertimeModel.findOneAndUpdate(
    filter,
    { $set: patch },
    { new: true },
  ).lean()
  return doc ? mapOvertime(doc as LeanDoc) : null
}

export async function listAttendanceOvertime(filter: {
  organizationId: string
  employeeId?: string
  status?: string
  branchIds?: string[]
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof AttendanceOvertimeModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.status) query.status = filter.status
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  const [items, total] = await Promise.all([
    AttendanceOvertimeModel.find(query)
      .sort({ workDate: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    AttendanceOvertimeModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapOvertime), total }
}

export async function tryInsertWorkforceNotificationIntent(data: {
  organizationId: string
  employeeId?: string
  intentKey: string
  kind: string
  payload?: Record<string, unknown>
}) {
  try {
    await WorkforceNotificationIntentModel.create({
      organizationId: oid(data.organizationId),
      employeeId: oid(data.employeeId),
      intentKey: data.intentKey,
      kind: data.kind,
      payload: data.payload,
    })
    return true
  } catch (error) {
    if (isDuplicateKey(error)) return false
    throw error
  }
}

export async function tryInsertWorkforceOutboxEvent(data: {
  organizationId: string
  eventKey: string
  eventType: string
  payload?: Record<string, unknown>
}) {
  try {
    await WorkforceOutboxEventModel.create({
      organizationId: oid(data.organizationId),
      eventKey: data.eventKey,
      eventType: data.eventType,
      payload: data.payload,
    })
    return true
  } catch (error) {
    if (isDuplicateKey(error)) return false
    throw error
  }
}

export async function tryInsertImportBatch(data: Record<string, unknown>) {
  try {
    const doc = await AttendanceImportBatchModel.create({
      ...data,
      organizationId: oid(String(data.organizationId)),
      createdBy: oid(String(data.createdBy)),
    })
    return { id: sid(doc._id), externalBatchId: sid(doc.externalBatchId) }
  } catch (error) {
    if (isDuplicateKey(error)) return null
    throw error
  }
}

export async function countPendingCorrections(organizationId: string, branchIds?: string[]) {
  const query: FilterQuery<typeof AttendanceCorrectionModel> = {
    organizationId: oid(organizationId),
    status: { $in: ['REQUESTED', 'UNDER_REVIEW'] },
  }
  if (branchIds?.length) query.branchId = { $in: branchIds.map((id) => oid(id)) }
  return AttendanceCorrectionModel.countDocuments(query)
}

export async function countPendingLeave(organizationId: string, branchIds?: string[]) {
  const query: FilterQuery<typeof LeaveRequestModel> = {
    organizationId: oid(organizationId),
    status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] },
  }
  if (branchIds?.length) query.branchId = { $in: branchIds.map((id) => oid(id)) }
  return LeaveRequestModel.countDocuments(query)
}
