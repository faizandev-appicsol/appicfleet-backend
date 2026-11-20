import { Schema, model } from 'mongoose'
import {
  CYCLE_STATUSES,
  DEVELOPMENT_STATUSES,
  ENTITY_ACTIVE_STATUSES,
  FEEDBACK_TYPES,
  GOAL_PRIORITIES,
  GOAL_STATUSES,
  KPI_SOURCES,
  ONE_ON_ONE_STATUSES,
  PEER_CONFIDENTIALITY,
  PIP_STATUSES,
  REVIEW_STATUSES,
  REVIEW_TYPES,
  SUCCESSION_READINESS,
  TRAINING_RECOMMENDATION_STATUSES,
  VISIBILITY_LEVELS,
} from '../constants/performance.js'

const decimalString = { type: String, trim: true, maxlength: 20 }

const ratingScaleSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000 },
    minValue: { type: Number, required: true, min: 1, max: 10, default: 1 },
    maxValue: { type: Number, required: true, min: 1, max: 10, default: 5 },
    levels: [
      {
        value: { type: Number, required: true },
        label: { type: String, required: true, trim: true, maxlength: 120 },
        description: { type: String, trim: true, maxlength: 500 },
      },
    ],
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)
ratingScaleSchema.index({ organizationId: 1, name: 1 })

const performanceTemplateSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 4000 },
    reviewType: {
      type: String,
      required: true,
      enum: Object.values(REVIEW_TYPES),
      default: REVIEW_TYPES.ANNUAL,
    },
    version: { type: Number, required: true, min: 1, default: 1 },
    includeGoals: { type: Boolean, default: true },
    includeKpis: { type: Boolean, default: true },
    includeCompetencies: { type: Boolean, default: true },
    includeSelfReview: { type: Boolean, default: true },
    includeManagerReview: { type: Boolean, default: true },
    includePeerReview: { type: Boolean, default: false },
    includeDevelopment: { type: Boolean, default: true },
    requireGoalWeightTotal100: { type: Boolean, default: true },
    sections: [
      {
        code: { type: String, required: true, trim: true, maxlength: 40 },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        required: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
        weight: decimalString,
      },
    ],
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)
performanceTemplateSchema.index({ organizationId: 1, name: 1, version: 1 }, { unique: true })

const performanceCycleSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    branchIds: [{ type: Schema.Types.ObjectId, ref: 'Branch' }],
    departmentIds: [{ type: Schema.Types.ObjectId, ref: 'HrDepartment' }],
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 4000 },
    reviewType: {
      type: String,
      required: true,
      enum: Object.values(REVIEW_TYPES),
      default: REVIEW_TYPES.ANNUAL,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reviewDeadline: { type: Date },
    status: {
      type: String,
      required: true,
      enum: Object.values(CYCLE_STATUSES),
      default: CYCLE_STATUSES.DRAFT,
    },
    ratingScaleId: { type: Schema.Types.ObjectId, ref: 'RatingScale', required: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'PerformanceTemplate', required: true },
    templateVersion: { type: Number, required: true, min: 1 },
    templateSnapshot: { type: Schema.Types.Mixed },
    ratingScaleSnapshot: { type: Schema.Types.Mixed },
    requirePeerReview: { type: Boolean, default: false },
    requireCalibration: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    openedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true },
)
performanceCycleSchema.index({ organizationId: 1, status: 1, startDate: -1 })
performanceCycleSchema.index({ organizationId: 1, name: 1 })

const competencyFrameworkSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 4000 },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    competencies: [
      {
        code: { type: String, required: true, trim: true, maxlength: 40 },
        name: { type: String, required: true, trim: true, maxlength: 200 },
        category: { type: String, trim: true, maxlength: 80 },
        description: { type: String, trim: true, maxlength: 2000 },
        expectedBehaviors: { type: String, trim: true, maxlength: 4000 },
        weight: decimalString,
        proficiencyLevels: [
          {
            level: { type: Number, required: true },
            label: { type: String, required: true, trim: true, maxlength: 80 },
            description: { type: String, trim: true, maxlength: 500 },
          },
        ],
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)
competencyFrameworkSchema.index({ organizationId: 1, name: 1 }, { unique: true })

const kpiDefinitionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 4000 },
    category: { type: String, trim: true, maxlength: 80 },
    unit: { type: String, trim: true, maxlength: 40 },
    measurementType: { type: String, trim: true, maxlength: 40 },
    dataSource: {
      type: String,
      required: true,
      enum: Object.values(KPI_SOURCES),
      default: KPI_SOURCES.MANUAL,
    },
    calculationMethod: { type: String, trim: true, maxlength: 200 },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)
kpiDefinitionSchema.index({ organizationId: 1, name: 1 }, { unique: true })

const employeeGoalSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    managerEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    cycleId: { type: Schema.Types.ObjectId, ref: 'PerformanceCycle' },
    reviewId: { type: Schema.Types.ObjectId, ref: 'PerformanceReview' },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 4000 },
    category: { type: String, trim: true, maxlength: 80 },
    startDate: { type: Date },
    dueDate: { type: Date },
    weight: { ...decimalString, required: true, default: '0.00' },
    targetValue: decimalString,
    currentValue: decimalString,
    unit: { type: String, trim: true, maxlength: 40 },
    progressPercent: { ...decimalString, default: '0.00' },
    measurementMethod: {
      type: String,
      enum: ['NUMERIC', 'MANUAL_PERCENT'],
      default: 'MANUAL_PERCENT',
    },
    priority: {
      type: String,
      enum: Object.values(GOAL_PRIORITIES),
      default: GOAL_PRIORITIES.MEDIUM,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(GOAL_STATUSES),
      default: GOAL_STATUSES.DRAFT,
    },
    employeeComments: { type: String, trim: true, maxlength: 4000 },
    managerComments: { type: String, trim: true, maxlength: 4000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)
employeeGoalSchema.index({ organizationId: 1, employeeId: 1, cycleId: 1 })
employeeGoalSchema.index({ organizationId: 1, status: 1, dueDate: 1 })

const goalProgressHistorySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    goalId: { type: Schema.Types.ObjectId, ref: 'EmployeeGoal', required: true },
    previousProgressPercent: decimalString,
    newProgressPercent: decimalString,
    previousCurrentValue: decimalString,
    newCurrentValue: decimalString,
    previousStatus: { type: String },
    newStatus: { type: String },
    notes: { type: String, trim: true, maxlength: 2000 },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)
goalProgressHistorySchema.index({ organizationId: 1, goalId: 1, createdAt: -1 })

const performanceReviewSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    cycleId: { type: Schema.Types.ObjectId, ref: 'PerformanceCycle', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    managerEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    templateId: { type: Schema.Types.ObjectId, ref: 'PerformanceTemplate', required: true },
    templateVersion: { type: Number, required: true },
    templateSnapshot: { type: Schema.Types.Mixed },
    ratingScaleSnapshot: { type: Schema.Types.Mixed },
    competencySnapshot: { type: Schema.Types.Mixed },
    status: {
      type: String,
      required: true,
      enum: Object.values(REVIEW_STATUSES),
      default: REVIEW_STATUSES.DRAFT,
    },
    selfAssessment: {
      achievements: { type: String, trim: true, maxlength: 8000 },
      challenges: { type: String, trim: true, maxlength: 8000 },
      developmentNeeds: { type: String, trim: true, maxlength: 8000 },
      comments: { type: String, trim: true, maxlength: 8000 },
      competencyRatings: [
        {
          competencyCode: { type: String, required: true },
          rating: { type: Number },
          comments: { type: String, trim: true, maxlength: 2000 },
        },
      ],
      submittedAt: { type: Date },
      submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    managerAssessment: {
      strengths: { type: String, trim: true, maxlength: 8000 },
      improvements: { type: String, trim: true, maxlength: 8000 },
      developmentRecommendations: { type: String, trim: true, maxlength: 8000 },
      comments: { type: String, trim: true, maxlength: 8000 },
      overallRating: { type: Number },
      competencyRatings: [
        {
          competencyCode: { type: String, required: true },
          rating: { type: Number },
          comments: { type: String, trim: true, maxlength: 2000 },
        },
      ],
      goalRatings: [
        {
          goalId: { type: Schema.Types.ObjectId, ref: 'EmployeeGoal' },
          rating: { type: Number },
          comments: { type: String, trim: true, maxlength: 2000 },
        },
      ],
      submittedAt: { type: Date },
      submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    originalManagerRating: { type: Number },
    calibratedRating: { type: Number },
    finalRating: { type: Number },
    ratingBreakdown: { type: Schema.Types.Mixed },
    finalComments: { type: String, trim: true, maxlength: 8000 },
    meetingScheduledAt: { type: Date },
    meetingCompletedAt: { type: Date },
    meetingNotes: { type: String, trim: true, maxlength: 8000 },
    finalizedAt: { type: Date },
    finalizedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)
performanceReviewSchema.index(
  { organizationId: 1, cycleId: 1, employeeId: 1 },
  { unique: true },
)
performanceReviewSchema.index({ organizationId: 1, status: 1, updatedAt: -1 })
performanceReviewSchema.index({ organizationId: 1, managerEmployeeId: 1, status: 1 })

const peerReviewSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    reviewId: { type: Schema.Types.ObjectId, ref: 'PerformanceReview', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    reviewerEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    confidentiality: {
      type: String,
      required: true,
      enum: Object.values(PEER_CONFIDENTIALITY),
      default: PEER_CONFIDENTIALITY.CONFIDENTIAL,
    },
    ratings: [
      {
        competencyCode: { type: String, required: true },
        rating: { type: Number },
        comments: { type: String, trim: true, maxlength: 2000 },
      },
    ],
    comments: { type: String, trim: true, maxlength: 4000 },
    status: {
      type: String,
      enum: ['REQUESTED', 'SUBMITTED', 'DECLINED'],
      default: 'REQUESTED',
    },
    submittedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)
peerReviewSchema.index({ organizationId: 1, reviewId: 1, reviewerEmployeeId: 1 }, { unique: true })

const calibrationSessionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    cycleId: { type: Schema.Types.ObjectId, ref: 'PerformanceCycle', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'DRAFT',
    },
    participants: [
      {
        reviewId: { type: Schema.Types.ObjectId, ref: 'PerformanceReview', required: true },
        employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
        originalRating: { type: Number },
        proposedRating: { type: Number },
        finalRating: { type: Number },
        comments: { type: String, trim: true, maxlength: 2000 },
      },
    ],
    comments: { type: String, trim: true, maxlength: 4000 },
    finalizedAt: { type: Date },
    finalizedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)
calibrationSessionSchema.index({ organizationId: 1, cycleId: 1, createdAt: -1 })

const performanceImprovementPlanSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    managerEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    reviewId: { type: Schema.Types.ObjectId, ref: 'PerformanceReview' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 4000 },
    concerns: { type: String, trim: true, maxlength: 8000 },
    expectations: { type: String, trim: true, maxlength: 8000 },
    measurementCriteria: { type: String, trim: true, maxlength: 4000 },
    goals: [
      {
        title: { type: String, required: true, trim: true, maxlength: 200 },
        description: { type: String, trim: true, maxlength: 2000 },
        dueDate: { type: Date },
        status: { type: String, default: 'PENDING' },
      },
    ],
    checkIns: [
      {
        scheduledAt: { type: Date, required: true },
        completedAt: { type: Date },
        notes: { type: String, trim: true, maxlength: 4000 },
        outcome: { type: String, trim: true, maxlength: 80 },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    status: {
      type: String,
      required: true,
      enum: Object.values(PIP_STATUSES),
      default: PIP_STATUSES.DRAFT,
    },
    outcome: { type: String, trim: true, maxlength: 2000 },
    managerComments: { type: String, trim: true, maxlength: 4000 },
    employeeComments: { type: String, trim: true, maxlength: 4000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)
performanceImprovementPlanSchema.index({ organizationId: 1, employeeId: 1, status: 1 })

const oneOnOneSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    managerEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    scheduledAt: { type: Date, required: true },
    agenda: { type: String, trim: true, maxlength: 4000 },
    discussionPoints: { type: String, trim: true, maxlength: 8000 },
    privateManagerNotes: { type: String, trim: true, maxlength: 8000 },
    sharedNotes: { type: String, trim: true, maxlength: 8000 },
    actionItems: [
      {
        title: { type: String, required: true, trim: true, maxlength: 200 },
        ownerEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
        dueDate: { type: Date },
        status: { type: String, default: 'OPEN' },
      },
    ],
    followUpDate: { type: Date },
    status: {
      type: String,
      required: true,
      enum: Object.values(ONE_ON_ONE_STATUSES),
      default: ONE_ON_ONE_STATUSES.SCHEDULED,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)
oneOnOneSchema.index({ organizationId: 1, employeeId: 1, scheduledAt: -1 })
oneOnOneSchema.index({ organizationId: 1, managerEmployeeId: 1, scheduledAt: -1 })

const continuousFeedbackSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    senderUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    feedbackType: {
      type: String,
      required: true,
      enum: Object.values(FEEDBACK_TYPES),
    },
    category: { type: String, trim: true, maxlength: 80 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    visibility: {
      type: String,
      required: true,
      enum: Object.values(VISIBILITY_LEVELS),
      default: VISIBILITY_LEVELS.MANAGER_ONLY,
    },
    relatedGoalId: { type: Schema.Types.ObjectId, ref: 'EmployeeGoal' },
    relatedCompetencyCode: { type: String, trim: true, maxlength: 40 },
    relatedReviewId: { type: Schema.Types.ObjectId, ref: 'PerformanceReview' },
  },
  { timestamps: true },
)
continuousFeedbackSchema.index({ organizationId: 1, recipientEmployeeId: 1, createdAt: -1 })

const recognitionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    recognizerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, trim: true, maxlength: 80 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    visibility: {
      type: String,
      required: true,
      enum: Object.values(VISIBILITY_LEVELS),
      default: VISIBILITY_LEVELS.TEAM,
    },
    relatedCompetencyCode: { type: String, trim: true, maxlength: 40 },
    relatedGoalId: { type: Schema.Types.ObjectId, ref: 'EmployeeGoal' },
  },
  { timestamps: true },
)
recognitionSchema.index({ organizationId: 1, employeeId: 1, createdAt: -1 })

const developmentPlanSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    reviewId: { type: Schema.Types.ObjectId, ref: 'PerformanceReview' },
    objective: { type: String, required: true, trim: true, maxlength: 400 },
    competencyCode: { type: String, trim: true, maxlength: 40 },
    currentProficiency: { type: Number },
    targetProficiency: { type: Number },
    targetDate: { type: Date },
    ownerEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    status: {
      type: String,
      required: true,
      enum: Object.values(DEVELOPMENT_STATUSES),
      default: DEVELOPMENT_STATUSES.PLANNED,
    },
    progressPercent: { ...decimalString, default: '0.00' },
    notes: { type: String, trim: true, maxlength: 4000 },
    actions: [
      {
        title: { type: String, required: true, trim: true, maxlength: 200 },
        actionType: {
          type: String,
          enum: ['TRAINING', 'MENTORING', 'COACHING', 'CERTIFICATION', 'JOB_SHADOWING', 'PROJECT', 'OTHER'],
          default: 'OTHER',
        },
        dueDate: { type: Date },
        status: {
          type: String,
          enum: Object.values(DEVELOPMENT_STATUSES),
          default: DEVELOPMENT_STATUSES.PLANNED,
        },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)
developmentPlanSchema.index({ organizationId: 1, employeeId: 1, status: 1 })

const trainingRecommendationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    reviewId: { type: Schema.Types.ObjectId, ref: 'PerformanceReview' },
    competencyCode: { type: String, trim: true, maxlength: 40 },
    topic: { type: String, required: true, trim: true, maxlength: 200 },
    reason: { type: String, trim: true, maxlength: 2000 },
    priority: {
      type: String,
      enum: Object.values(GOAL_PRIORITIES),
      default: GOAL_PRIORITIES.MEDIUM,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(TRAINING_RECOMMENDATION_STATUSES),
      default: TRAINING_RECOMMENDATION_STATUSES.RECOMMENDED,
    },
    recommendedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)
trainingRecommendationSchema.index({ organizationId: 1, employeeId: 1, status: 1 })

const successionPlanSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    criticalPositionId: { type: Schema.Types.ObjectId, ref: 'HrPosition' },
    criticalPositionTitle: { type: String, required: true, trim: true, maxlength: 200 },
    candidates: [
      {
        employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
        readiness: {
          type: String,
          enum: Object.values(SUCCESSION_READINESS),
          default: SUCCESSION_READINESS.DEVELOPMENT_REQUIRED,
        },
        developmentGaps: { type: String, trim: true, maxlength: 4000 },
        developmentPlanId: { type: Schema.Types.ObjectId, ref: 'DevelopmentPlan' },
        riskNotes: { type: String, trim: true, maxlength: 2000 },
      },
    ],
    status: {
      type: String,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)
successionPlanSchema.index({ organizationId: 1, criticalPositionTitle: 1 })

const performanceNotificationIntentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    kind: { type: String, required: true, trim: true, maxlength: 80 },
    intentKey: { type: String, required: true, trim: true, maxlength: 160 },
    entityType: { type: String, required: true, trim: true, maxlength: 60 },
    entityId: { type: String, required: true, trim: true, maxlength: 40 },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    payload: { type: Schema.Types.Mixed },
    status: { type: String, default: 'PENDING' },
  },
  { timestamps: true },
)
performanceNotificationIntentSchema.index({ organizationId: 1, intentKey: 1 }, { unique: true })

const performanceOutboxEventSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    eventKey: { type: String, required: true, trim: true, maxlength: 160 },
    eventType: { type: String, required: true, trim: true, maxlength: 80 },
    payload: { type: Schema.Types.Mixed },
    status: { type: String, default: 'PENDING' },
  },
  { timestamps: true },
)
performanceOutboxEventSchema.index({ organizationId: 1, eventKey: 1 }, { unique: true })

export const RatingScaleModel = model('RatingScale', ratingScaleSchema, 'rating_scales')
export const PerformanceTemplateModel = model(
  'PerformanceTemplate',
  performanceTemplateSchema,
  'performance_templates',
)
export const PerformanceCycleModel = model(
  'PerformanceCycle',
  performanceCycleSchema,
  'performance_cycles',
)
export const CompetencyFrameworkModel = model(
  'CompetencyFramework',
  competencyFrameworkSchema,
  'competency_frameworks',
)
export const KpiDefinitionModel = model('KpiDefinition', kpiDefinitionSchema, 'kpi_definitions')
export const EmployeeGoalModel = model('EmployeeGoal', employeeGoalSchema, 'employee_goals')
export const GoalProgressHistoryModel = model(
  'GoalProgressHistory',
  goalProgressHistorySchema,
  'goal_progress_history',
)
export const PerformanceReviewModel = model(
  'PerformanceReview',
  performanceReviewSchema,
  'performance_reviews',
)
export const PeerReviewModel = model('PeerReview', peerReviewSchema, 'peer_reviews')
export const CalibrationSessionModel = model(
  'CalibrationSession',
  calibrationSessionSchema,
  'calibration_sessions',
)
export const PerformanceImprovementPlanModel = model(
  'PerformanceImprovementPlan',
  performanceImprovementPlanSchema,
  'performance_improvement_plans',
)
export const OneOnOneModel = model('OneOnOne', oneOnOneSchema, 'one_on_ones')
export const ContinuousFeedbackModel = model(
  'ContinuousFeedback',
  continuousFeedbackSchema,
  'continuous_feedback',
)
export const RecognitionModel = model('Recognition', recognitionSchema, 'performance_recognitions')
export const DevelopmentPlanModel = model(
  'DevelopmentPlan',
  developmentPlanSchema,
  'development_plans',
)
export const TrainingRecommendationModel = model(
  'TrainingRecommendation',
  trainingRecommendationSchema,
  'training_recommendations',
)
export const SuccessionPlanModel = model(
  'SuccessionPlan',
  successionPlanSchema,
  'succession_plans',
)
export const PerformanceNotificationIntentModel = model(
  'PerformanceNotificationIntent',
  performanceNotificationIntentSchema,
  'performance_notification_intents',
)
export const PerformanceOutboxEventModel = model(
  'PerformanceOutboxEvent',
  performanceOutboxEventSchema,
  'performance_outbox_events',
)
