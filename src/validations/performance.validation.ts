import { z } from 'zod'
import {
  FEEDBACK_TYPES,
  GOAL_PRIORITIES,
  KPI_SOURCES,
  PEER_CONFIDENTIALITY,
  REVIEW_TYPES,
  SUCCESSION_READINESS,
  VISIBILITY_LEVELS,
} from '../constants/performance.js'
import { objectIdSchema, paginationQuerySchema } from './common.validation.js'
import { enumInput, instantSchema, optionalText } from './vehicle.validation.js'

const weightSchema = z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/)

export const performanceSummaryQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  cycleId: objectIdSchema.optional(),
})

export const listPerformanceQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: z.string().trim().max(40).optional(),
  cycleId: objectIdSchema.optional(),
  employeeId: objectIdSchema.optional(),
  managerEmployeeId: objectIdSchema.optional(),
})

export const createRatingScaleBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  name: z.string().trim().min(2).max(120),
  description: optionalText(2000),
  minValue: z.number().int().min(1).max(10).optional(),
  maxValue: z.number().int().min(1).max(10).optional(),
  levels: z
    .array(
      z.object({
        value: z.number().int().min(1).max(10),
        label: z.string().trim().min(1).max(120),
        description: optionalText(500),
      }),
    )
    .max(20)
    .optional(),
})

export const createTemplateBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  name: z.string().trim().min(2).max(200),
  description: optionalText(4000),
  reviewType: enumInput(Object.values(REVIEW_TYPES)).optional(),
  includePeerReview: z.boolean().optional(),
  requireGoalWeightTotal100: z.boolean().optional(),
  sections: z
    .array(
      z.object({
        code: z.string().trim().min(1).max(40),
        title: z.string().trim().min(1).max(200),
        required: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
        weight: weightSchema.optional(),
      }),
    )
    .max(50)
    .optional(),
})

export const createCycleBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  branchIds: z.array(objectIdSchema).max(50).optional(),
  departmentIds: z.array(objectIdSchema).max(50).optional(),
  name: z.string().trim().min(2).max(200),
  description: optionalText(4000),
  reviewType: enumInput(Object.values(REVIEW_TYPES)).optional(),
  startDate: instantSchema,
  endDate: instantSchema,
  reviewDeadline: instantSchema.optional(),
  ratingScaleId: objectIdSchema,
  templateId: objectIdSchema,
  requirePeerReview: z.boolean().optional(),
  requireCalibration: z.boolean().optional(),
})

export const cycleTransitionBodySchema = z.object({
  status: z.enum([
    'CONFIGURING',
    'OPEN',
    'SELF_REVIEW',
    'MANAGER_REVIEW',
    'PEER_REVIEW',
    'CALIBRATION',
    'FINALIZATION',
    'COMPLETED',
    'CANCELLED',
  ]),
})

export const createGoalBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  managerEmployeeId: objectIdSchema.optional(),
  cycleId: objectIdSchema.optional(),
  title: z.string().trim().min(2).max(200),
  description: optionalText(4000),
  category: optionalText(80),
  startDate: instantSchema.optional(),
  dueDate: instantSchema.optional(),
  weight: weightSchema.optional(),
  targetValue: z.string().trim().max(20).optional(),
  currentValue: z.string().trim().max(20).optional(),
  unit: optionalText(40),
  progressPercent: weightSchema.optional(),
  measurementMethod: z.enum(['NUMERIC', 'MANUAL_PERCENT']).optional(),
  priority: enumInput(Object.values(GOAL_PRIORITIES)).optional(),
  employeeComments: optionalText(4000),
})

export const updateGoalProgressBodySchema = z.object({
  currentValue: z.string().trim().max(20).optional(),
  progressPercent: weightSchema.optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'AT_RISK', 'COMPLETED', 'CANCELLED', 'OVERDUE']).optional(),
  employeeComments: optionalText(4000),
  managerComments: optionalText(4000),
  notes: optionalText(2000),
})

export const createReviewBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  cycleId: objectIdSchema,
  employeeId: objectIdSchema,
  managerEmployeeId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  competencyFrameworkId: objectIdSchema.optional(),
})

export const selfAssessmentBodySchema = z.object({
  achievements: optionalText(8000),
  challenges: optionalText(8000),
  developmentNeeds: optionalText(8000),
  comments: optionalText(8000),
  competencyRatings: z
    .array(
      z.object({
        competencyCode: z.string().trim().min(1).max(40),
        rating: z.number().min(1).max(10).optional(),
        comments: optionalText(2000),
      }),
    )
    .max(50)
    .optional(),
})

export const managerAssessmentBodySchema = z.object({
  strengths: optionalText(8000),
  improvements: optionalText(8000),
  developmentRecommendations: optionalText(8000),
  comments: optionalText(8000),
  overallRating: z.number().min(1).max(10).optional(),
  competencyRatings: z
    .array(
      z.object({
        competencyCode: z.string().trim().min(1).max(40),
        rating: z.number().min(1).max(10).optional(),
        comments: optionalText(2000),
      }),
    )
    .max(50)
    .optional(),
  goalRatings: z
    .array(
      z.object({
        goalId: objectIdSchema,
        rating: z.number().min(1).max(10).optional(),
        comments: optionalText(2000),
      }),
    )
    .max(50)
    .optional(),
  skipPeerReview: z.boolean().optional(),
  skipCalibration: z.boolean().optional(),
})

export const peerRequestBodySchema = z.object({
  reviewerEmployeeId: objectIdSchema,
  confidentiality: enumInput(Object.values(PEER_CONFIDENTIALITY)).optional(),
})

export const peerSubmitBodySchema = z.object({
  ratings: z
    .array(
      z.object({
        competencyCode: z.string().trim().min(1).max(40),
        rating: z.number().min(1).max(10).optional(),
        comments: optionalText(2000),
      }),
    )
    .max(50)
    .optional(),
  comments: optionalText(4000),
})

export const finalizeReviewBodySchema = z.object({
  finalRating: z.number().min(1).max(10).optional(),
  finalComments: optionalText(8000),
  meetingNotes: optionalText(8000),
})

export const reviewTransitionBodySchema = z.object({
  status: z.enum([
    'SELF_REVIEW',
    'MANAGER_REVIEW',
    'PEER_REVIEW',
    'CALIBRATION',
    'FINAL_REVIEW',
    'APPROVED',
    'COMPLETED',
    'CANCELLED',
  ]),
})

export const createCalibrationBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  cycleId: objectIdSchema,
  name: z.string().trim().min(2).max(200),
  participants: z
    .array(
      z.object({
        reviewId: objectIdSchema,
        employeeId: objectIdSchema,
        originalRating: z.number().optional(),
        proposedRating: z.number().optional(),
      }),
    )
    .min(1)
    .max(200),
})

export const finalizeCalibrationBodySchema = z.object({
  participants: z
    .array(
      z.object({
        reviewId: objectIdSchema,
        employeeId: objectIdSchema,
        originalRating: z.number().optional(),
        proposedRating: z.number().optional(),
        finalRating: z.number().min(1).max(10),
        comments: optionalText(2000),
      }),
    )
    .min(1)
    .max(200),
  comments: optionalText(4000),
})

export const createPipBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  managerEmployeeId: objectIdSchema.optional(),
  reviewId: objectIdSchema.optional(),
  startDate: instantSchema,
  endDate: instantSchema,
  reason: z.string().trim().min(2).max(4000),
  concerns: optionalText(8000),
  expectations: optionalText(8000),
  measurementCriteria: optionalText(4000),
  goals: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        description: optionalText(2000),
        dueDate: instantSchema.optional(),
      }),
    )
    .max(50)
    .optional(),
})

export const updatePipBodySchema = z.object({
  status: z
    .enum([
      'DRAFT',
      'ACTIVE',
      'ON_TRACK',
      'AT_RISK',
      'COMPLETED',
      'SUCCESSFUL',
      'UNSUCCESSFUL',
      'CANCELLED',
    ])
    .optional(),
  outcome: optionalText(2000),
  managerComments: optionalText(4000),
  employeeComments: optionalText(4000),
  checkIn: z
    .object({
      scheduledAt: instantSchema,
      notes: optionalText(4000),
      outcome: optionalText(80),
    })
    .optional(),
})

export const createOneOnOneBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  managerEmployeeId: objectIdSchema,
  scheduledAt: instantSchema,
  agenda: optionalText(4000),
  actionItems: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        dueDate: instantSchema.optional(),
      }),
    )
    .max(50)
    .optional(),
})

export const createFeedbackBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  recipientEmployeeId: objectIdSchema,
  feedbackType: enumInput(Object.values(FEEDBACK_TYPES)),
  category: optionalText(80),
  message: z.string().trim().min(1).max(4000),
  visibility: enumInput(Object.values(VISIBILITY_LEVELS)).optional(),
  relatedGoalId: objectIdSchema.optional(),
  relatedCompetencyCode: optionalText(40),
  relatedReviewId: objectIdSchema.optional(),
})

export const createRecognitionBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  category: optionalText(80),
  message: z.string().trim().min(1).max(4000),
  visibility: enumInput(Object.values(VISIBILITY_LEVELS)).optional(),
  relatedCompetencyCode: optionalText(40),
  relatedGoalId: objectIdSchema.optional(),
})

export const createDevelopmentPlanBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  reviewId: objectIdSchema.optional(),
  objective: z.string().trim().min(2).max(400),
  competencyCode: optionalText(40),
  currentProficiency: z.number().int().min(1).max(10).optional(),
  targetProficiency: z.number().int().min(1).max(10).optional(),
  targetDate: instantSchema.optional(),
  actions: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        actionType: z
          .enum([
            'TRAINING',
            'MENTORING',
            'COACHING',
            'CERTIFICATION',
            'JOB_SHADOWING',
            'PROJECT',
            'OTHER',
          ])
          .optional(),
        dueDate: instantSchema.optional(),
      }),
    )
    .max(50)
    .optional(),
})

export const createFrameworkBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  name: z.string().trim().min(2).max(200),
  description: optionalText(4000),
  competencies: z
    .array(
      z.object({
        code: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1).max(200),
        category: optionalText(80),
        description: optionalText(2000),
        expectedBehaviors: optionalText(4000),
        weight: weightSchema.optional(),
      }),
    )
    .min(1)
    .max(100),
})

export const createKpiBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  name: z.string().trim().min(2).max(200),
  description: optionalText(4000),
  category: optionalText(80),
  unit: optionalText(40),
  dataSource: enumInput(Object.values(KPI_SOURCES)).optional(),
  calculationMethod: optionalText(200),
})

export const createTrainingRecommendationBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  reviewId: objectIdSchema.optional(),
  competencyCode: optionalText(40),
  topic: z.string().trim().min(2).max(200),
  reason: optionalText(2000),
  priority: enumInput(Object.values(GOAL_PRIORITIES)).optional(),
})

export const createSuccessionBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  criticalPositionId: objectIdSchema.optional(),
  criticalPositionTitle: z.string().trim().min(2).max(200),
  candidates: z
    .array(
      z.object({
        employeeId: objectIdSchema,
        readiness: enumInput(Object.values(SUCCESSION_READINESS)).optional(),
        developmentGaps: optionalText(4000),
        riskNotes: optionalText(2000),
      }),
    )
    .min(1)
    .max(50),
})
