import { Schema, model } from 'mongoose'
import {
  ATTENDANCE_EXCEPTION_CODES,
  ATTENDANCE_SOURCES,
  ATTENDANCE_STATUSES,
  BREAK_TYPES,
  CORRECTION_STATUSES,
  ENTITY_ACTIVE_STATUSES,
  LEAVE_ACCRUAL_METHODS,
  LEAVE_BALANCE_TX_TYPES,
  LEAVE_DAY_PARTS,
  LEAVE_REQUEST_STATUSES,
  OVERTIME_REQUEST_STATUSES,
  WEEKDAY_CODES,
} from '../constants/workforce.js'

const breakPeriodSchema = new Schema(
  {
    startTime: { type: String, required: true, trim: true, maxlength: 5 },
    endTime: { type: String, required: true, trim: true, maxlength: 5 },
    type: { type: String, enum: Object.values(BREAK_TYPES), default: BREAK_TYPES.OTHER },
  },
  { _id: false },
)

const workScheduleSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 32 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    nameAr: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    timezone: { type: String, required: true, trim: true, maxlength: 64 },
    workingDays: {
      type: [{ type: String, enum: Object.values(WEEKDAY_CODES) }],
      default: [
        WEEKDAY_CODES.MON,
        WEEKDAY_CODES.TUE,
        WEEKDAY_CODES.WED,
        WEEKDAY_CODES.THU,
        WEEKDAY_CODES.FRI,
      ],
    },
    startTime: { type: String, required: true, trim: true, maxlength: 5 },
    endTime: { type: String, required: true, trim: true, maxlength: 5 },
    breaks: { type: [breakPeriodSchema], default: [] },
    graceMinutes: { type: Number, required: true, min: 0, max: 240, default: 15 },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'work_schedules' },
)
workScheduleSchema.index({ organizationId: 1, code: 1 }, { unique: true })
workScheduleSchema.index({ organizationId: 1, status: 1 })

const shiftDefinitionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 32 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    nameAr: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    timezone: { type: String, required: true, trim: true, maxlength: 64 },
    startTime: { type: String, required: true, trim: true, maxlength: 5 },
    endTime: { type: String, required: true, trim: true, maxlength: 5 },
    breaks: { type: [breakPeriodSchema], default: [] },
    graceMinutes: { type: Number, required: true, min: 0, max: 240, default: 15 },
    crossesMidnight: { type: Boolean, default: false },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'shift_definitions' },
)
shiftDefinitionSchema.index({ organizationId: 1, code: 1 }, { unique: true })
shiftDefinitionSchema.index({ organizationId: 1, status: 1 })

const employeeScheduleAssignmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    workScheduleId: { type: Schema.Types.ObjectId, ref: 'WorkSchedule' },
    shiftDefinitionId: { type: Schema.Types.ObjectId, ref: 'ShiftDefinition' },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    reason: { type: String, trim: true, maxlength: 500 },
    previousAssignmentId: { type: Schema.Types.ObjectId, ref: 'EmployeeScheduleAssignment' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'employee_schedule_assignments' },
)
employeeScheduleAssignmentSchema.index({ organizationId: 1, employeeId: 1, effectiveFrom: -1 })
employeeScheduleAssignmentSchema.index({ organizationId: 1, employeeId: 1, status: 1 })
employeeScheduleAssignmentSchema.index({ organizationId: 1, branchId: 1, status: 1 })

const scheduleHistorySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    previousAssignmentId: { type: Schema.Types.ObjectId, ref: 'EmployeeScheduleAssignment' },
    newAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'EmployeeScheduleAssignment',
      required: true,
    },
    previousWorkScheduleId: { type: Schema.Types.ObjectId, ref: 'WorkSchedule' },
    previousShiftDefinitionId: { type: Schema.Types.ObjectId, ref: 'ShiftDefinition' },
    newWorkScheduleId: { type: Schema.Types.ObjectId, ref: 'WorkSchedule' },
    newShiftDefinitionId: { type: Schema.Types.ObjectId, ref: 'ShiftDefinition' },
    effectiveFrom: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 500 },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'schedule_history' },
)
scheduleHistorySchema.index({ organizationId: 1, employeeId: 1, createdAt: -1 })

const attendanceBreakSchema = new Schema(
  {
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 0 },
    type: { type: String, enum: Object.values(BREAK_TYPES), default: BREAK_TYPES.OTHER },
  },
  { _id: true },
)

const attendanceRecordSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    businessDate: { type: String, required: true, trim: true, maxlength: 10 },
    timezone: { type: String, required: true, trim: true, maxlength: 64 },
    workScheduleId: { type: Schema.Types.ObjectId, ref: 'WorkSchedule' },
    shiftDefinitionId: { type: Schema.Types.ObjectId, ref: 'ShiftDefinition' },
    scheduleAssignmentId: { type: Schema.Types.ObjectId, ref: 'EmployeeScheduleAssignment' },
    scheduledStart: { type: Date },
    scheduledEnd: { type: Date },
    clockInAt: { type: Date },
    clockOutAt: { type: Date },
    breaks: { type: [attendanceBreakSchema], default: [] },
    scheduledDurationMinutes: { type: Number, default: 0 },
    breakDurationMinutes: { type: Number, default: 0 },
    workedDurationMinutes: { type: Number, default: 0 },
    lateDurationMinutes: { type: Number, default: 0 },
    earlyLeaveDurationMinutes: { type: Number, default: 0 },
    overtimeDurationMinutes: { type: Number, default: 0 },
    status: {
      type: String,
      required: true,
      enum: Object.values(ATTENDANCE_STATUSES),
      default: ATTENDANCE_STATUSES.ABSENT,
    },
    source: {
      type: String,
      required: true,
      enum: Object.values(ATTENDANCE_SOURCES),
      default: ATTENDANCE_SOURCES.SYSTEM,
    },
    notes: { type: String, trim: true, maxlength: 2000 },
    leaveRequestId: { type: Schema.Types.ObjectId, ref: 'LeaveRequest' },
    holidayId: { type: Schema.Types.ObjectId, ref: 'Holiday' },
    externalReference: { type: String, trim: true, maxlength: 128 },
    metadata: { type: Schema.Types.Mixed },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'attendance_records' },
)
attendanceRecordSchema.index(
  { organizationId: 1, employeeId: 1, businessDate: 1 },
  { unique: true },
)
attendanceRecordSchema.index({ organizationId: 1, branchId: 1, businessDate: 1, status: 1 })
attendanceRecordSchema.index({ organizationId: 1, status: 1, businessDate: 1 })
attendanceRecordSchema.index(
  { organizationId: 1, externalReference: 1 },
  { unique: true, sparse: true },
)

const attendanceCorrectionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    attendanceRecordId: { type: Schema.Types.ObjectId, ref: 'AttendanceRecord', required: true },
    originalClockInAt: { type: Date },
    originalClockOutAt: { type: Date },
    originalStatus: { type: String, enum: Object.values(ATTENDANCE_STATUSES) },
    requestedClockInAt: { type: Date },
    requestedClockOutAt: { type: Date },
    requestedStatus: { type: String, enum: Object.values(ATTENDANCE_STATUSES) },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    status: {
      type: String,
      required: true,
      enum: Object.values(CORRECTION_STATUSES),
      default: CORRECTION_STATUSES.REQUESTED,
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNotes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true, collection: 'attendance_corrections' },
)
attendanceCorrectionSchema.index({ organizationId: 1, status: 1, createdAt: -1 })
attendanceCorrectionSchema.index({ organizationId: 1, attendanceRecordId: 1, createdAt: -1 })

const attendanceExceptionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    attendanceRecordId: { type: Schema.Types.ObjectId, ref: 'AttendanceRecord' },
    businessDate: { type: String, required: true, trim: true, maxlength: 10 },
    code: { type: String, required: true, enum: Object.values(ATTENDANCE_EXCEPTION_CODES) },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'attendance_exceptions' },
)
attendanceExceptionSchema.index({ organizationId: 1, resolved: 1, businessDate: -1 })
attendanceExceptionSchema.index({ organizationId: 1, employeeId: 1, code: 1, businessDate: 1 })

const leaveTypeSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 32 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    nameAr: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    paid: { type: Boolean, default: true },
    requiresApproval: { type: Boolean, default: true },
    requiresDocument: { type: Boolean, default: false },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'leave_types' },
)
leaveTypeSchema.index({ organizationId: 1, code: 1 }, { unique: true })

const leavePolicySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    accrualMethod: {
      type: String,
      required: true,
      enum: Object.values(LEAVE_ACCRUAL_METHODS),
      default: LEAVE_ACCRUAL_METHODS.ANNUAL,
    },
    annualEntitlementDays: { type: String, required: true, trim: true, maxlength: 12 },
    carryForwardAllowed: { type: Boolean, default: false },
    maxCarryForwardDays: { type: String, trim: true, maxlength: 12 },
    expiryMonths: { type: Number, min: 0, max: 60 },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'leave_policies' },
)
leavePolicySchema.index({ organizationId: 1, leaveTypeId: 1, effectiveFrom: -1 })
leavePolicySchema.index({ organizationId: 1, status: 1 })

const employeeLeaveBalanceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    leavePolicyId: { type: Schema.Types.ObjectId, ref: 'LeavePolicy' },
    periodYear: { type: Number, required: true },
    openingDays: { type: String, required: true, trim: true, maxlength: 12, default: '0.00' },
    accruedDays: { type: String, required: true, trim: true, maxlength: 12, default: '0.00' },
    usedDays: { type: String, required: true, trim: true, maxlength: 12, default: '0.00' },
    pendingDays: { type: String, required: true, trim: true, maxlength: 12, default: '0.00' },
    adjustedDays: { type: String, required: true, trim: true, maxlength: 12, default: '0.00' },
    availableDays: { type: String, required: true, trim: true, maxlength: 12, default: '0.00' },
    version: { type: Number, required: true, default: 1 },
  },
  { timestamps: true, collection: 'employee_leave_balances' },
)
employeeLeaveBalanceSchema.index(
  { organizationId: 1, employeeId: 1, leaveTypeId: 1, periodYear: 1 },
  { unique: true },
)

const leaveBalanceTransactionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    leaveBalanceId: { type: Schema.Types.ObjectId, ref: 'EmployeeLeaveBalance', required: true },
    leaveRequestId: { type: Schema.Types.ObjectId, ref: 'LeaveRequest' },
    type: { type: String, required: true, enum: Object.values(LEAVE_BALANCE_TX_TYPES) },
    days: { type: String, required: true, trim: true, maxlength: 12 },
    balanceAfter: { type: String, required: true, trim: true, maxlength: 12 },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 128 },
    note: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'leave_balance_transactions' },
)
leaveBalanceTransactionSchema.index(
  { organizationId: 1, idempotencyKey: 1 },
  { unique: true },
)
leaveBalanceTransactionSchema.index({ organizationId: 1, leaveBalanceId: 1, createdAt: -1 })

const leaveRequestSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    startDate: { type: String, required: true, trim: true, maxlength: 10 },
    endDate: { type: String, required: true, trim: true, maxlength: 10 },
    dayPart: {
      type: String,
      required: true,
      enum: Object.values(LEAVE_DAY_PARTS),
      default: LEAVE_DAY_PARTS.FULL_DAY,
    },
    partialHours: { type: String, trim: true, maxlength: 12 },
    daysRequested: { type: String, required: true, trim: true, maxlength: 12 },
    reason: { type: String, trim: true, maxlength: 2000 },
    documentStorageKey: { type: String, trim: true, maxlength: 128 },
    status: {
      type: String,
      required: true,
      enum: Object.values(LEAVE_REQUEST_STATUSES),
      default: LEAVE_REQUEST_STATUSES.DRAFT,
    },
    submittedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNotes: { type: String, trim: true, maxlength: 2000 },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    idempotencyKey: { type: String, trim: true, maxlength: 128 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'leave_requests' },
)
leaveRequestSchema.index({ organizationId: 1, employeeId: 1, status: 1, startDate: -1 })
leaveRequestSchema.index({ organizationId: 1, status: 1, startDate: 1, endDate: 1 })
leaveRequestSchema.index(
  { organizationId: 1, idempotencyKey: 1 },
  { unique: true, sparse: true },
)

const leaveApprovalSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    leaveRequestId: { type: Schema.Types.ObjectId, ref: 'LeaveRequest', required: true },
    step: { type: Number, required: true, min: 1 },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, enum: ['APPROVE', 'REJECT', 'CANCEL', 'REVERSE'] },
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true, collection: 'leave_approvals' },
)
leaveApprovalSchema.index({ organizationId: 1, leaveRequestId: 1, createdAt: -1 })

const holidaySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    nameAr: { type: String, trim: true, maxlength: 200 },
    date: { type: String, required: true, trim: true, maxlength: 10 },
    country: { type: String, trim: true, uppercase: true, maxlength: 2 },
    recurring: { type: Boolean, default: false },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'holidays' },
)
holidaySchema.index({ organizationId: 1, date: 1, branchId: 1 })
holidaySchema.index({ organizationId: 1, status: 1, date: 1 })

const attendanceOvertimeSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    attendanceRecordId: { type: Schema.Types.ObjectId, ref: 'AttendanceRecord' },
    workDate: { type: String, required: true, trim: true, maxlength: 10 },
    minutes: { type: Number, required: true, min: 0 },
    hours: { type: String, required: true, trim: true, maxlength: 12 },
    reason: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      required: true,
      enum: Object.values(OVERTIME_REQUEST_STATUSES),
      default: OVERTIME_REQUEST_STATUSES.DRAFT,
    },
    payrollOvertimeId: { type: Schema.Types.ObjectId, ref: 'PayrollOvertime' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'attendance_overtime' },
)
attendanceOvertimeSchema.index({ organizationId: 1, employeeId: 1, workDate: 1 })
attendanceOvertimeSchema.index({ organizationId: 1, status: 1, workDate: 1 })

const attendanceImportBatchSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    source: { type: String, required: true, enum: Object.values(ATTENDANCE_SOURCES) },
    externalBatchId: { type: String, required: true, trim: true, maxlength: 128 },
    status: { type: String, required: true, enum: ['PENDING', 'PROCESSED', 'FAILED'], default: 'PENDING' },
    rowCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    errors: { type: [Schema.Types.Mixed], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'attendance_import_batches' },
)
attendanceImportBatchSchema.index(
  { organizationId: 1, externalBatchId: 1 },
  { unique: true },
)

const workforceNotificationIntentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    intentKey: { type: String, required: true, trim: true, maxlength: 160 },
    kind: { type: String, required: true, trim: true, maxlength: 80 },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'workforce_notification_intents' },
)
workforceNotificationIntentSchema.index({ organizationId: 1, intentKey: 1 }, { unique: true })

const workforceOutboxEventSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    eventKey: { type: String, required: true, trim: true, maxlength: 160 },
    eventType: { type: String, required: true, trim: true, maxlength: 80 },
    payload: { type: Schema.Types.Mixed },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'workforce_outbox_events' },
)
workforceOutboxEventSchema.index({ organizationId: 1, eventKey: 1 }, { unique: true })
workforceOutboxEventSchema.index({ organizationId: 1, eventType: 1, createdAt: -1 })

export const WorkScheduleModel = model('WorkSchedule', workScheduleSchema)
export const ShiftDefinitionModel = model('ShiftDefinition', shiftDefinitionSchema)
export const EmployeeScheduleAssignmentModel = model(
  'EmployeeScheduleAssignment',
  employeeScheduleAssignmentSchema,
)
export const ScheduleHistoryModel = model('ScheduleHistory', scheduleHistorySchema)
export const AttendanceRecordModel = model('AttendanceRecord', attendanceRecordSchema)
export const AttendanceCorrectionModel = model('AttendanceCorrection', attendanceCorrectionSchema)
export const AttendanceExceptionModel = model('AttendanceException', attendanceExceptionSchema)
export const LeaveTypeModel = model('LeaveType', leaveTypeSchema)
export const LeavePolicyModel = model('LeavePolicy', leavePolicySchema)
export const EmployeeLeaveBalanceModel = model('EmployeeLeaveBalance', employeeLeaveBalanceSchema)
export const LeaveBalanceTransactionModel = model(
  'LeaveBalanceTransaction',
  leaveBalanceTransactionSchema,
)
export const LeaveRequestModel = model('LeaveRequest', leaveRequestSchema)
export const LeaveApprovalModel = model('LeaveApproval', leaveApprovalSchema)
export const HolidayModel = model('Holiday', holidaySchema)
export const AttendanceOvertimeModel = model('AttendanceOvertime', attendanceOvertimeSchema)
export const AttendanceImportBatchModel = model('AttendanceImportBatch', attendanceImportBatchSchema)
export const WorkforceNotificationIntentModel = model(
  'WorkforceNotificationIntent',
  workforceNotificationIntentSchema,
)
export const WorkforceOutboxEventModel = model('WorkforceOutboxEvent', workforceOutboxEventSchema)
