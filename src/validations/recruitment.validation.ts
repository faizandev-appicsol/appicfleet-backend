import { z } from 'zod'
import {
  CANDIDATE_DOCUMENT_TYPES,
  CANDIDATE_SOURCES,
  INTERVIEW_RECOMMENDATIONS,
  INTERVIEW_TYPES,
  POSTING_VISIBILITIES,
  REQUISITION_PRIORITIES,
} from '../constants/recruitment.js'
import { EMPLOYMENT_TYPES } from '../constants/hr.js'
import { objectIdSchema, paginationQuerySchema } from './common.validation.js'
import { enumInput, instantSchema, moneySchema, optionalText } from './vehicle.validation.js'

export const recruitmentSummaryQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
})

export const listRecruitmentQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: z.string().trim().max(40).optional(),
  stageCode: z.string().trim().max(40).optional(),
  candidateId: objectIdSchema.optional(),
  requisitionId: objectIdSchema.optional(),
  q: z.string().trim().max(100).optional(),
  from: instantSchema.optional(),
  to: instantSchema.optional(),
})

export const createRequisitionBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  branchId: objectIdSchema,
  jobTitle: z.string().trim().min(2).max(200),
  positionId: objectIdSchema.optional(),
  departmentId: objectIdSchema.optional(),
  hiringManagerEmployeeId: objectIdSchema.optional(),
  recruiterUserId: objectIdSchema.optional(),
  openings: z.number().int().min(1).max(500).optional(),
  employmentType: enumInput(Object.values(EMPLOYMENT_TYPES)).optional(),
  targetStartDate: instantSchema.optional(),
  salaryMin: moneySchema.optional(),
  salaryMax: moneySchema.optional(),
  currency: z.string().trim().length(3).optional(),
  jobDescription: optionalText(8000),
  requirements: optionalText(8000),
  responsibilities: optionalText(8000),
  priority: enumInput(Object.values(REQUISITION_PRIORITIES)).optional(),
  reasonForHiring: optionalText(2000),
})

export const updateRequisitionBodySchema = createRequisitionBodySchema
  .omit({ organizationId: true, legalEntityId: true, branchId: true })
  .partial()

export const requisitionDecisionBodySchema = z.object({
  approve: z.boolean(),
  notes: optionalText(2000),
})

export const requisitionTransitionBodySchema = z.object({
  status: z.enum(['OPEN', 'ON_HOLD', 'FILLED', 'CANCELLED', 'CLOSED', 'PENDING_APPROVAL']),
})

export const createPostingBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  requisitionId: objectIdSchema,
  title: optionalText(200),
  description: optionalText(8000),
  requirements: optionalText(8000),
  responsibilities: optionalText(8000),
  location: optionalText(200),
  visibility: enumInput(Object.values(POSTING_VISIBILITIES)).optional(),
  applicationDeadline: instantSchema.optional(),
  publish: z.boolean().optional(),
})

export const createCandidateBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  firstName: z.string().trim().min(1).max(100),
  middleName: optionalText(100),
  lastName: z.string().trim().min(1).max(100),
  preferredName: optionalText(100),
  email: z.string().trim().email().max(200),
  phone: optionalText(40),
  location: optionalText(200),
  country: z.string().trim().length(2).optional(),
  currentEmployer: optionalText(200),
  currentTitle: optionalText(200),
  yearsOfExperience: z.number().min(0).max(80).optional(),
  skills: z.array(z.string().trim().max(80)).max(50).optional(),
  qualifications: optionalText(4000),
  certifications: optionalText(4000),
  languages: z.array(z.string().trim().max(40)).max(20).optional(),
  source: enumInput(Object.values(CANDIDATE_SOURCES)).optional(),
  notes: optionalText(4000),
  allowDuplicate: z.boolean().optional(),
})

export const updateCandidateBodySchema = createCandidateBodySchema
  .omit({ organizationId: true, email: true })
  .partial()
  .extend({
    email: z.string().trim().email().max(200).optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED', 'BLACKLISTED']).optional(),
  })

export const candidateNoteBodySchema = z.object({
  content: z.string().trim().min(1).max(4000),
  applicationId: objectIdSchema.optional(),
})

export const candidateDocumentBodySchema = z.object({
  documentType: enumInput(Object.values(CANDIDATE_DOCUMENT_TYPES)),
  fileName: z.string().trim().min(1).max(255),
  storageKey: z.string().trim().min(1).max(128),
  mimeType: optionalText(120),
})

export const createApplicationBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  candidateId: objectIdSchema,
  postingId: objectIdSchema,
  source: enumInput(Object.values(CANDIDATE_SOURCES)).optional(),
  notes: optionalText(4000),
  idempotencyKey: optionalText(128),
})

export const changeStageBodySchema = z.object({
  stageCode: z.string().trim().min(1).max(40),
  reason: optionalText(500),
  notes: optionalText(2000),
})

export const scheduleInterviewBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  applicationId: objectIdSchema,
  interviewType: enumInput(Object.values(INTERVIEW_TYPES)).optional(),
  interviewerUserIds: z.array(objectIdSchema).min(1).max(20),
  scheduledStart: instantSchema,
  scheduledEnd: instantSchema,
  timezone: z.string().trim().max(64).optional(),
  location: optionalText(300),
  meetingLink: optionalText(500),
  notes: optionalText(4000),
})

export const rescheduleInterviewBodySchema = z.object({
  scheduledStart: instantSchema,
  scheduledEnd: instantSchema,
  timezone: z.string().trim().max(64).optional(),
  location: optionalText(300),
  meetingLink: optionalText(500),
  notes: optionalText(4000),
})

export const interviewFeedbackBodySchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  recommendation: enumInput(Object.values(INTERVIEW_RECOMMENDATIONS)),
  strengths: optionalText(4000),
  concerns: optionalText(4000),
  notes: optionalText(4000),
})

export const createOfferBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  applicationId: objectIdSchema,
  proposedStartDate: instantSchema,
  employmentType: enumInput(Object.values(EMPLOYMENT_TYPES)).optional(),
  baseSalary: moneySchema,
  allowancesSummary: optionalText(2000),
  benefitsSummary: optionalText(4000),
  currency: z.string().trim().length(3).optional(),
  compensationStructureId: objectIdSchema.optional(),
  expiresAt: instantSchema,
  notes: optionalText(4000),
  idempotencyKey: optionalText(128),
})

export const offerDecisionBodySchema = z.object({
  approve: z.boolean(),
  reason: optionalText(2000),
})

export const offerResponseBodySchema = z.object({
  accept: z.boolean(),
  notes: optionalText(2000),
})

export const candidateOfferTokenBodySchema = z.object({
  token: z.string().trim().min(32).max(128),
  accept: z.boolean(),
  notes: optionalText(2000),
})

export const convertHireBodySchema = z.object({
  offerId: objectIdSchema,
  templateId: objectIdSchema.optional(),
  workEmail: z.string().trim().email().max(200).optional(),
  workScheduleId: objectIdSchema.optional(),
  shiftDefinitionId: objectIdSchema.optional(),
  compensationStructureId: objectIdSchema.optional(),
  basicSalary: moneySchema.optional(),
  assignedHrUserId: objectIdSchema.optional(),
  idempotencyKey: optionalText(128),
})

export const createOnboardingTemplateBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(200),
  description: optionalText(2000),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        description: optionalText(2000),
        category: optionalText(80),
        required: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
        dependsOnSortOrder: z.number().int().min(0).optional(),
      }),
    )
    .max(100),
})

export const completeTaskBodySchema = z.object({
  evidenceStorageKey: optionalText(128),
})

export const completeOnboardingBodySchema = z.object({
  overrideReason: optionalText(2000),
})
