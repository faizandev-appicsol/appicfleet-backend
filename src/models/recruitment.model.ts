import { Schema, model } from 'mongoose'
import { EMPLOYMENT_TYPES } from '../constants/hr.js'
import {
  APPLICATION_STATUSES,
  CANDIDATE_ACTIVITY_TYPES,
  CANDIDATE_DOCUMENT_TYPES,
  CANDIDATE_SOURCES,
  CANDIDATE_STATUSES,
  ENTITY_ACTIVE_STATUSES,
  INTERVIEW_RECOMMENDATIONS,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
  OFFER_STATUSES,
  ONBOARDING_STATUSES,
  ONBOARDING_TASK_STATUSES,
  POSTING_STATUSES,
  POSTING_VISIBILITIES,
  REQUISITION_PRIORITIES,
  REQUISITION_STATUSES,
} from '../constants/recruitment.js'

const moneyString = { type: String, trim: true, maxlength: 20 }

const jobRequisitionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    requisitionNumber: { type: String, required: true, trim: true, maxlength: 40 },
    jobTitle: { type: String, required: true, trim: true, maxlength: 200 },
    positionId: { type: Schema.Types.ObjectId, ref: 'HrPosition' },
    departmentId: { type: Schema.Types.ObjectId, ref: 'HrDepartment' },
    hiringManagerEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    recruiterUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    openings: { type: Number, required: true, min: 1, max: 500, default: 1 },
    employmentType: {
      type: String,
      required: true,
      enum: Object.values(EMPLOYMENT_TYPES),
      default: EMPLOYMENT_TYPES.FULL_TIME,
    },
    targetStartDate: { type: Date },
    salaryMin: moneyString,
    salaryMax: moneyString,
    currency: { type: String, uppercase: true, maxlength: 3, default: 'AED' },
    jobDescription: { type: String, trim: true, maxlength: 8000 },
    requirements: { type: String, trim: true, maxlength: 8000 },
    responsibilities: { type: String, trim: true, maxlength: 8000 },
    status: {
      type: String,
      required: true,
      enum: Object.values(REQUISITION_STATUSES),
      default: REQUISITION_STATUSES.DRAFT,
    },
    priority: {
      type: String,
      required: true,
      enum: Object.values(REQUISITION_PRIORITIES),
      default: REQUISITION_PRIORITIES.MEDIUM,
    },
    reasonForHiring: { type: String, trim: true, maxlength: 2000 },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    approvalNotes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'job_requisitions' },
)
jobRequisitionSchema.index({ organizationId: 1, requisitionNumber: 1 }, { unique: true })
jobRequisitionSchema.index({ organizationId: 1, status: 1, createdAt: -1 })
jobRequisitionSchema.index({ organizationId: 1, branchId: 1, status: 1 })

const jobPostingSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    requisitionId: { type: Schema.Types.ObjectId, ref: 'JobRequisition', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 8000 },
    requirements: { type: String, trim: true, maxlength: 8000 },
    responsibilities: { type: String, trim: true, maxlength: 8000 },
    location: { type: String, trim: true, maxlength: 200 },
    employmentType: { type: String, enum: Object.values(EMPLOYMENT_TYPES) },
    departmentId: { type: Schema.Types.ObjectId, ref: 'HrDepartment' },
    positionId: { type: Schema.Types.ObjectId, ref: 'HrPosition' },
    salaryMin: moneyString,
    salaryMax: moneyString,
    currency: { type: String, uppercase: true, maxlength: 3 },
    applicationDeadline: { type: Date },
    status: {
      type: String,
      required: true,
      enum: Object.values(POSTING_STATUSES),
      default: POSTING_STATUSES.DRAFT,
    },
    visibility: {
      type: String,
      required: true,
      enum: Object.values(POSTING_VISIBILITIES),
      default: POSTING_VISIBILITIES.INTERNAL,
    },
    publishedAt: { type: Date },
    closedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'job_postings' },
)
jobPostingSchema.index({ organizationId: 1, status: 1, publishedAt: -1 })
jobPostingSchema.index({ organizationId: 1, requisitionId: 1 })

const recruitmentStageSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameAr: { type: String, trim: true, maxlength: 120 },
    sortOrder: { type: Number, required: true, default: 0 },
    mapsToStatus: {
      type: String,
      required: true,
      enum: Object.values(APPLICATION_STATUSES),
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
  },
  { timestamps: true, collection: 'recruitment_stages' },
)
recruitmentStageSchema.index({ organizationId: 1, code: 1 }, { unique: true })
recruitmentStageSchema.index({ organizationId: 1, sortOrder: 1 })

const candidateSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    middleName: { type: String, trim: true, maxlength: 100 },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    preferredName: { type: String, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 40 },
    location: { type: String, trim: true, maxlength: 200 },
    country: { type: String, trim: true, uppercase: true, maxlength: 2 },
    currentEmployer: { type: String, trim: true, maxlength: 200 },
    currentTitle: { type: String, trim: true, maxlength: 200 },
    yearsOfExperience: { type: Number, min: 0, max: 80 },
    skills: { type: [String], default: [] },
    qualifications: { type: String, trim: true, maxlength: 4000 },
    certifications: { type: String, trim: true, maxlength: 4000 },
    languages: { type: [String], default: [] },
    resumeStorageKey: { type: String, trim: true, maxlength: 128 },
    source: {
      type: String,
      required: true,
      enum: Object.values(CANDIDATE_SOURCES),
      default: CANDIDATE_SOURCES.DIRECT,
    },
    recruiterUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      required: true,
      enum: Object.values(CANDIDATE_STATUSES),
      default: CANDIDATE_STATUSES.ACTIVE,
    },
    notes: { type: String, trim: true, maxlength: 4000 },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    hiredAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'candidates' },
)
candidateSchema.index({ organizationId: 1, email: 1 })
candidateSchema.index({ organizationId: 1, phone: 1 }, { sparse: true })
candidateSchema.index({ organizationId: 1, status: 1, lastName: 1, firstName: 1 })
candidateSchema.index({
  organizationId: 1,
  lastName: 'text',
  firstName: 'text',
  email: 'text',
  currentEmployer: 'text',
})

const candidateDocumentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    documentType: {
      type: String,
      required: true,
      enum: Object.values(CANDIDATE_DOCUMENT_TYPES),
    },
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, trim: true, maxlength: 120 },
    storageKey: { type: String, required: true, trim: true, maxlength: 128 },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'candidate_documents' },
)
candidateDocumentSchema.index({ organizationId: 1, candidateId: 1, createdAt: -1 })

const applicationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    postingId: { type: Schema.Types.ObjectId, ref: 'JobPosting', required: true },
    requisitionId: { type: Schema.Types.ObjectId, ref: 'JobRequisition', required: true },
    appliedAt: { type: Date, required: true, default: Date.now },
    stageCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    status: {
      type: String,
      required: true,
      enum: Object.values(APPLICATION_STATUSES),
      default: APPLICATION_STATUSES.NEW,
    },
    source: {
      type: String,
      enum: Object.values(CANDIDATE_SOURCES),
      default: CANDIDATE_SOURCES.DIRECT,
    },
    recruiterUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true, maxlength: 4000 },
    idempotencyKey: { type: String, trim: true, maxlength: 128 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'applications' },
)
applicationSchema.index(
  { organizationId: 1, candidateId: 1, postingId: 1 },
  { unique: true },
)
applicationSchema.index({ organizationId: 1, status: 1, stageCode: 1, appliedAt: -1 })
applicationSchema.index({ organizationId: 1, requisitionId: 1, status: 1 })
applicationSchema.index(
  { organizationId: 1, idempotencyKey: 1 },
  { unique: true, sparse: true },
)

const applicationStageHistorySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    previousStageCode: { type: String, trim: true, maxlength: 40 },
    newStageCode: { type: String, required: true, trim: true, maxlength: 40 },
    previousStatus: { type: String, enum: Object.values(APPLICATION_STATUSES) },
    newStatus: { type: String, required: true, enum: Object.values(APPLICATION_STATUSES) },
    reason: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 2000 },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'application_stage_history' },
)
applicationStageHistorySchema.index({ organizationId: 1, applicationId: 1, createdAt: -1 })

const interviewSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    interviewType: {
      type: String,
      required: true,
      enum: Object.values(INTERVIEW_TYPES),
      default: INTERVIEW_TYPES.VIDEO,
    },
    interviewerUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true, maxlength: 64 },
    location: { type: String, trim: true, maxlength: 300 },
    meetingLink: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      required: true,
      enum: Object.values(INTERVIEW_STATUSES),
      default: INTERVIEW_STATUSES.SCHEDULED,
    },
    notes: { type: String, trim: true, maxlength: 4000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'interviews' },
)
interviewSchema.index({ organizationId: 1, scheduledStart: 1, status: 1 })
interviewSchema.index({ organizationId: 1, applicationId: 1, scheduledStart: -1 })
interviewSchema.index({ organizationId: 1, candidateId: 1, scheduledStart: -1 })

const interviewFeedbackSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    interviewId: { type: Schema.Types.ObjectId, ref: 'Interview', required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    interviewerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5 },
    recommendation: {
      type: String,
      required: true,
      enum: Object.values(INTERVIEW_RECOMMENDATIONS),
    },
    strengths: { type: String, trim: true, maxlength: 4000 },
    concerns: { type: String, trim: true, maxlength: 4000 },
    notes: { type: String, trim: true, maxlength: 4000 },
    submittedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, collection: 'interview_feedback' },
)
interviewFeedbackSchema.index(
  { organizationId: 1, interviewId: 1, interviewerUserId: 1 },
  { unique: true },
)

const evaluationCriterionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
  },
  { timestamps: true, collection: 'evaluation_criteria' },
)
evaluationCriterionSchema.index({ organizationId: 1, code: 1 }, { unique: true })

const candidateEvaluationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    criterionId: { type: Schema.Types.ObjectId, ref: 'EvaluationCriterion', required: true },
    score: { type: Number, min: 1, max: 5, required: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    evaluatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'candidate_evaluations' },
)
candidateEvaluationSchema.index({ organizationId: 1, applicationId: 1, criterionId: 1 })

const offerSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    requisitionId: { type: Schema.Types.ObjectId, ref: 'JobRequisition', required: true },
    positionId: { type: Schema.Types.ObjectId, ref: 'HrPosition' },
    departmentId: { type: Schema.Types.ObjectId, ref: 'HrDepartment' },
    proposedStartDate: { type: Date, required: true },
    employmentType: {
      type: String,
      required: true,
      enum: Object.values(EMPLOYMENT_TYPES),
      default: EMPLOYMENT_TYPES.FULL_TIME,
    },
    baseSalary: { type: String, required: true, trim: true, maxlength: 20 },
    allowancesSummary: { type: String, trim: true, maxlength: 2000 },
    benefitsSummary: { type: String, trim: true, maxlength: 4000 },
    currency: { type: String, required: true, uppercase: true, maxlength: 3, default: 'AED' },
    compensationStructureId: { type: Schema.Types.ObjectId, ref: 'CompensationStructure' },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(OFFER_STATUSES),
      default: OFFER_STATUSES.DRAFT,
    },
    notes: { type: String, trim: true, maxlength: 4000 },
    offerLetterStorageKey: { type: String, trim: true, maxlength: 128 },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    sentAt: { type: Date },
    respondedAt: { type: Date },
    responseNotes: { type: String, trim: true, maxlength: 2000 },
    idempotencyKey: { type: String, trim: true, maxlength: 128 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'offers' },
)
offerSchema.index({ organizationId: 1, applicationId: 1, status: 1 })
offerSchema.index({ organizationId: 1, candidateId: 1, createdAt: -1 })
offerSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true, sparse: true })

const offerApprovalSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    offerId: { type: Schema.Types.ObjectId, ref: 'Offer', required: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    decision: { type: String, required: true, enum: ['APPROVE', 'REJECT', 'WITHDRAW'] },
    reason: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true, collection: 'offer_approvals' },
)
offerApprovalSchema.index({ organizationId: 1, offerId: 1, createdAt: -1 })

const onboardingTemplateTaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    category: { type: String, trim: true, maxlength: 80 },
    required: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    dependsOnSortOrder: { type: Number },
  },
  { _id: true },
)

const onboardingTemplateSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    tasks: { type: [onboardingTemplateTaskSchema], default: [] },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'onboarding_templates' },
)
onboardingTemplateSchema.index({ organizationId: 1, code: 1 }, { unique: true })

const employeeOnboardingSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate' },
    offerId: { type: Schema.Types.ObjectId, ref: 'Offer' },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
    templateId: { type: Schema.Types.ObjectId, ref: 'OnboardingTemplate' },
    startDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(ONBOARDING_STATUSES),
      default: ONBOARDING_STATUSES.NOT_STARTED,
    },
    assignedHrUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
    completionOverrideReason: { type: String, trim: true, maxlength: 2000 },
    progressPercent: { type: Number, min: 0, max: 100, default: 0 },
    workScheduleId: { type: Schema.Types.ObjectId, ref: 'WorkSchedule' },
    shiftDefinitionId: { type: Schema.Types.ObjectId, ref: 'ShiftDefinition' },
    compensationStructureId: { type: Schema.Types.ObjectId, ref: 'CompensationStructure' },
    idempotencyKey: { type: String, trim: true, maxlength: 128 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'employee_onboardings' },
)
employeeOnboardingSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true })
employeeOnboardingSchema.index({ organizationId: 1, status: 1, startDate: -1 })
employeeOnboardingSchema.index(
  { organizationId: 1, idempotencyKey: 1 },
  { unique: true, sparse: true },
)

const onboardingTaskSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    onboardingId: { type: Schema.Types.ObjectId, ref: 'EmployeeOnboarding', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    category: { type: String, trim: true, maxlength: 80 },
    required: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    dependsOnTaskId: { type: Schema.Types.ObjectId, ref: 'OnboardingTask' },
    assignedHrUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    dueDate: { type: Date },
    status: {
      type: String,
      required: true,
      enum: Object.values(ONBOARDING_TASK_STATUSES),
      default: ONBOARDING_TASK_STATUSES.PENDING,
    },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    evidenceStorageKey: { type: String, trim: true, maxlength: 128 },
  },
  { timestamps: true, collection: 'onboarding_tasks' },
)
onboardingTaskSchema.index({ organizationId: 1, onboardingId: 1, sortOrder: 1 })
onboardingTaskSchema.index({ organizationId: 1, status: 1, dueDate: 1 })

const candidateActivitySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
    type: {
      type: String,
      required: true,
      enum: Object.values(CANDIDATE_ACTIVITY_TYPES),
    },
    summary: { type: String, required: true, trim: true, maxlength: 500 },
    content: { type: String, trim: true, maxlength: 4000 },
    internalOnly: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'candidate_activities' },
)
candidateActivitySchema.index({ organizationId: 1, candidateId: 1, createdAt: -1 })

const candidateInvitationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    offerId: { type: Schema.Types.ObjectId, ref: 'Offer' },
    purpose: {
      type: String,
      required: true,
      enum: ['OFFER_VIEW', 'APPLICATION_STATUS', 'ONBOARDING'],
    },
    tokenHash: { type: String, required: true, trim: true, maxlength: 128 },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    revokedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'candidate_invitations' },
)
candidateInvitationSchema.index({ tokenHash: 1 }, { unique: true })
candidateInvitationSchema.index({ organizationId: 1, candidateId: 1, createdAt: -1 })

const recruitmentNotificationIntentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate' },
    intentKey: { type: String, required: true, trim: true, maxlength: 160 },
    kind: { type: String, required: true, trim: true, maxlength: 80 },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'recruitment_notification_intents' },
)
recruitmentNotificationIntentSchema.index({ organizationId: 1, intentKey: 1 }, { unique: true })

const recruitmentOutboxEventSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    eventKey: { type: String, required: true, trim: true, maxlength: 160 },
    eventType: { type: String, required: true, trim: true, maxlength: 80 },
    payload: { type: Schema.Types.Mixed },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'recruitment_outbox_events' },
)
recruitmentOutboxEventSchema.index({ organizationId: 1, eventKey: 1 }, { unique: true })

const recruitmentCounterSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: 'recruitment_counters' },
)
recruitmentCounterSchema.index({ organizationId: 1, name: 1 }, { unique: true })

export const JobRequisitionModel = model('JobRequisition', jobRequisitionSchema)
export const JobPostingModel = model('JobPosting', jobPostingSchema)
export const RecruitmentStageModel = model('RecruitmentStage', recruitmentStageSchema)
export const CandidateModel = model('Candidate', candidateSchema)
export const CandidateDocumentModel = model('CandidateDocument', candidateDocumentSchema)
export const ApplicationModel = model('Application', applicationSchema)
export const ApplicationStageHistoryModel = model(
  'ApplicationStageHistory',
  applicationStageHistorySchema,
)
export const InterviewModel = model('Interview', interviewSchema)
export const InterviewFeedbackModel = model('InterviewFeedback', interviewFeedbackSchema)
export const EvaluationCriterionModel = model('EvaluationCriterion', evaluationCriterionSchema)
export const CandidateEvaluationModel = model('CandidateEvaluation', candidateEvaluationSchema)
export const OfferModel = model('Offer', offerSchema)
export const OfferApprovalModel = model('OfferApproval', offerApprovalSchema)
export const OnboardingTemplateModel = model('OnboardingTemplate', onboardingTemplateSchema)
export const EmployeeOnboardingModel = model('EmployeeOnboarding', employeeOnboardingSchema)
export const OnboardingTaskModel = model('OnboardingTask', onboardingTaskSchema)
export const CandidateActivityModel = model('CandidateActivity', candidateActivitySchema)
export const CandidateInvitationModel = model('CandidateInvitation', candidateInvitationSchema)
export const RecruitmentNotificationIntentModel = model(
  'RecruitmentNotificationIntent',
  recruitmentNotificationIntentSchema,
)
export const RecruitmentOutboxEventModel = model(
  'RecruitmentOutboxEvent',
  recruitmentOutboxEventSchema,
)
export const RecruitmentCounterModel = model('RecruitmentCounter', recruitmentCounterSchema)
