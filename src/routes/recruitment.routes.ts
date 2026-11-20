import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  approveOfferHandler,
  approveRequisitionHandler,
  applicationsBySourceReportHandler,
  cancelInterviewHandler,
  candidateActivityHandler,
  candidateDocumentHandler,
  candidateNoteHandler,
  candidateOfferTokenHandler,
  candidateVolumeReportHandler,
  changeStageHandler,
  completeInterviewHandler,
  completeOnboardingHandler,
  completeTaskHandler,
  convertHireHandler,
  createApplicationHandler,
  createCandidateHandler,
  createOfferHandler,
  createPostingHandler,
  createRequisitionHandler,
  createTemplateHandler,
  getApplicationHandler,
  getCandidateHandler,
  getInterviewHandler,
  getOfferHandler,
  getOnboardingHandler,
  getRequisitionHandler,
  listApplicationsHandler,
  listCandidateDocumentsHandler,
  listCandidatesHandler,
  listFeedbackHandler,
  listInterviewsHandler,
  listOffersHandler,
  listOnboardingsHandler,
  listPostingsHandler,
  listRequisitionsHandler,
  listStagesHandler,
  listTemplatesHandler,
  offerLetterHandler,
  offersSummaryReportHandler,
  onboardingProgressReportHandler,
  openRequisitionsReportHandler,
  publishPostingHandler,
  recruitmentFunnelReportHandler,
  recruitmentSummaryHandler,
  rescheduleInterviewHandler,
  scheduleInterviewHandler,
  sendOfferHandler,
  staffOfferResponseHandler,
  submitFeedbackHandler,
  submitOfferHandler,
  submitRequisitionHandler,
  transitionRequisitionHandler,
  updateCandidateHandler,
  updateRequisitionHandler,
} from '../controllers/recruitment/recruitment.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import { idParamsSchema } from '../validations/common.validation.js'
import {
  candidateDocumentBodySchema,
  candidateNoteBodySchema,
  candidateOfferTokenBodySchema,
  changeStageBodySchema,
  completeOnboardingBodySchema,
  completeTaskBodySchema,
  convertHireBodySchema,
  createApplicationBodySchema,
  createCandidateBodySchema,
  createOfferBodySchema,
  createOnboardingTemplateBodySchema,
  createPostingBodySchema,
  createRequisitionBodySchema,
  interviewFeedbackBodySchema,
  listRecruitmentQuerySchema,
  offerDecisionBodySchema,
  offerResponseBodySchema,
  recruitmentSummaryQuerySchema,
  requisitionDecisionBodySchema,
  requisitionTransitionBodySchema,
  rescheduleInterviewBodySchema,
  scheduleInterviewBodySchema,
  updateCandidateBodySchema,
  updateRequisitionBodySchema,
} from '../validations/recruitment.validation.js'

export const recruitmentRouter = Router()

/** Candidate offer token response — no staff auth; token is the credential. */
recruitmentRouter.post(
  '/offers/token-response',
  validate({ body: candidateOfferTokenBodySchema }),
  candidateOfferTokenHandler,
)

recruitmentRouter.use(authenticate)

recruitmentRouter.get(
  '/summary',
  requirePermission(PERMISSIONS.RECRUITMENT_VIEW),
  validate({ query: recruitmentSummaryQuerySchema }),
  recruitmentSummaryHandler,
)

recruitmentRouter.get(
  '/stages',
  requirePermission(PERMISSIONS.APPLICATION_VIEW),
  validate({ query: recruitmentSummaryQuerySchema }),
  listStagesHandler,
)

recruitmentRouter.get(
  '/requisitions',
  requirePermission(PERMISSIONS.REQUISITION_VIEW),
  validate({ query: listRecruitmentQuerySchema }),
  listRequisitionsHandler,
)
recruitmentRouter.post(
  '/requisitions',
  requirePermission(PERMISSIONS.REQUISITION_CREATE),
  validate({ body: createRequisitionBodySchema }),
  createRequisitionHandler,
)
recruitmentRouter.get(
  '/requisitions/:id',
  requirePermission(PERMISSIONS.REQUISITION_VIEW),
  validate({ params: idParamsSchema }),
  getRequisitionHandler,
)
recruitmentRouter.patch(
  '/requisitions/:id',
  requirePermission(PERMISSIONS.REQUISITION_UPDATE),
  validate({ params: idParamsSchema, body: updateRequisitionBodySchema }),
  updateRequisitionHandler,
)
recruitmentRouter.post(
  '/requisitions/:id/submit',
  requirePermission(PERMISSIONS.REQUISITION_UPDATE),
  validate({ params: idParamsSchema }),
  submitRequisitionHandler,
)
recruitmentRouter.post(
  '/requisitions/:id/approve',
  requirePermission(PERMISSIONS.REQUISITION_APPROVE),
  validate({ params: idParamsSchema, body: requisitionDecisionBodySchema }),
  approveRequisitionHandler,
)
recruitmentRouter.post(
  '/requisitions/:id/transition',
  requirePermission(PERMISSIONS.REQUISITION_UPDATE),
  validate({ params: idParamsSchema, body: requisitionTransitionBodySchema }),
  transitionRequisitionHandler,
)

recruitmentRouter.get(
  '/postings',
  requirePermission(PERMISSIONS.REQUISITION_VIEW),
  validate({ query: listRecruitmentQuerySchema }),
  listPostingsHandler,
)
recruitmentRouter.post(
  '/postings',
  requirePermission(PERMISSIONS.REQUISITION_UPDATE),
  validate({ body: createPostingBodySchema }),
  createPostingHandler,
)
recruitmentRouter.post(
  '/postings/:id/publish',
  requirePermission(PERMISSIONS.REQUISITION_UPDATE),
  validate({ params: idParamsSchema }),
  publishPostingHandler,
)

recruitmentRouter.get(
  '/candidates',
  requirePermission(PERMISSIONS.CANDIDATE_VIEW),
  validate({ query: listRecruitmentQuerySchema }),
  listCandidatesHandler,
)
recruitmentRouter.post(
  '/candidates',
  requirePermission(PERMISSIONS.CANDIDATE_CREATE),
  validate({ body: createCandidateBodySchema }),
  createCandidateHandler,
)
recruitmentRouter.get(
  '/candidates/:id',
  requirePermission(PERMISSIONS.CANDIDATE_VIEW),
  validate({ params: idParamsSchema }),
  getCandidateHandler,
)
recruitmentRouter.patch(
  '/candidates/:id',
  requirePermission(PERMISSIONS.CANDIDATE_UPDATE),
  validate({ params: idParamsSchema, body: updateCandidateBodySchema }),
  updateCandidateHandler,
)
recruitmentRouter.post(
  '/candidates/:id/notes',
  requirePermission(PERMISSIONS.CANDIDATE_UPDATE),
  validate({ params: idParamsSchema, body: candidateNoteBodySchema }),
  candidateNoteHandler,
)
recruitmentRouter.get(
  '/candidates/:id/activity',
  requirePermission(PERMISSIONS.CANDIDATE_VIEW),
  validate({ params: idParamsSchema }),
  candidateActivityHandler,
)
recruitmentRouter.get(
  '/candidates/:id/documents',
  requirePermission(PERMISSIONS.CANDIDATE_VIEW),
  validate({ params: idParamsSchema }),
  listCandidateDocumentsHandler,
)
recruitmentRouter.post(
  '/candidates/:id/documents',
  requirePermission(PERMISSIONS.CANDIDATE_UPDATE),
  validate({ params: idParamsSchema, body: candidateDocumentBodySchema }),
  candidateDocumentHandler,
)

recruitmentRouter.get(
  '/applications',
  requirePermission(PERMISSIONS.APPLICATION_VIEW),
  validate({ query: listRecruitmentQuerySchema }),
  listApplicationsHandler,
)
recruitmentRouter.post(
  '/applications',
  requirePermission(PERMISSIONS.APPLICATION_MANAGE),
  validate({ body: createApplicationBodySchema }),
  createApplicationHandler,
)
recruitmentRouter.get(
  '/applications/:id',
  requirePermission(PERMISSIONS.APPLICATION_VIEW),
  validate({ params: idParamsSchema }),
  getApplicationHandler,
)
recruitmentRouter.post(
  '/applications/:id/stage',
  requirePermission(PERMISSIONS.APPLICATION_STAGE_MANAGE),
  validate({ params: idParamsSchema, body: changeStageBodySchema }),
  changeStageHandler,
)

recruitmentRouter.get(
  '/interviews',
  requirePermission(PERMISSIONS.INTERVIEW_VIEW),
  validate({ query: listRecruitmentQuerySchema }),
  listInterviewsHandler,
)
recruitmentRouter.post(
  '/interviews',
  requirePermission(PERMISSIONS.INTERVIEW_MANAGE),
  validate({ body: scheduleInterviewBodySchema }),
  scheduleInterviewHandler,
)
recruitmentRouter.get(
  '/interviews/:id',
  requirePermission(PERMISSIONS.INTERVIEW_VIEW),
  validate({ params: idParamsSchema }),
  getInterviewHandler,
)
recruitmentRouter.post(
  '/interviews/:id/reschedule',
  requirePermission(PERMISSIONS.INTERVIEW_MANAGE),
  validate({ params: idParamsSchema, body: rescheduleInterviewBodySchema }),
  rescheduleInterviewHandler,
)
recruitmentRouter.post(
  '/interviews/:id/complete',
  requirePermission(PERMISSIONS.INTERVIEW_MANAGE),
  validate({ params: idParamsSchema }),
  completeInterviewHandler,
)
recruitmentRouter.post(
  '/interviews/:id/cancel',
  requirePermission(PERMISSIONS.INTERVIEW_MANAGE),
  validate({ params: idParamsSchema }),
  cancelInterviewHandler,
)
recruitmentRouter.post(
  '/interviews/:id/feedback',
  requirePermission(PERMISSIONS.INTERVIEW_FEEDBACK_MANAGE),
  validate({ params: idParamsSchema, body: interviewFeedbackBodySchema }),
  submitFeedbackHandler,
)
recruitmentRouter.get(
  '/interviews/:id/feedback',
  requirePermission(PERMISSIONS.INTERVIEW_FEEDBACK_MANAGE),
  validate({ params: idParamsSchema }),
  listFeedbackHandler,
)

recruitmentRouter.get(
  '/offers',
  requirePermission(PERMISSIONS.OFFER_VIEW),
  validate({ query: listRecruitmentQuerySchema }),
  listOffersHandler,
)
recruitmentRouter.post(
  '/offers',
  requirePermission(PERMISSIONS.OFFER_CREATE),
  validate({ body: createOfferBodySchema }),
  createOfferHandler,
)
recruitmentRouter.get(
  '/offers/:id',
  requirePermission(PERMISSIONS.OFFER_VIEW),
  validate({ params: idParamsSchema }),
  getOfferHandler,
)
recruitmentRouter.post(
  '/offers/:id/submit',
  requirePermission(PERMISSIONS.OFFER_UPDATE),
  validate({ params: idParamsSchema }),
  submitOfferHandler,
)
recruitmentRouter.post(
  '/offers/:id/approve',
  requirePermission(PERMISSIONS.OFFER_APPROVE),
  validate({ params: idParamsSchema, body: offerDecisionBodySchema }),
  approveOfferHandler,
)
recruitmentRouter.post(
  '/offers/:id/send',
  requirePermission(PERMISSIONS.OFFER_SEND),
  validate({ params: idParamsSchema }),
  sendOfferHandler,
)
recruitmentRouter.post(
  '/offers/:id/respond',
  requirePermission(PERMISSIONS.OFFER_UPDATE),
  validate({ params: idParamsSchema, body: offerResponseBodySchema }),
  staffOfferResponseHandler,
)
recruitmentRouter.get(
  '/offers/:id/letter',
  requirePermission(PERMISSIONS.OFFER_VIEW),
  validate({ params: idParamsSchema }),
  offerLetterHandler,
)

recruitmentRouter.post(
  '/hire',
  requirePermission(PERMISSIONS.ONBOARDING_MANAGE),
  validate({ body: convertHireBodySchema }),
  convertHireHandler,
)

recruitmentRouter.get(
  '/onboarding',
  requirePermission(PERMISSIONS.ONBOARDING_VIEW),
  validate({ query: listRecruitmentQuerySchema }),
  listOnboardingsHandler,
)
recruitmentRouter.get(
  '/onboarding/:id',
  requirePermission(PERMISSIONS.ONBOARDING_VIEW),
  validate({ params: idParamsSchema }),
  getOnboardingHandler,
)
recruitmentRouter.post(
  '/onboarding/tasks/:id/complete',
  requirePermission(PERMISSIONS.ONBOARDING_TASK_MANAGE),
  validate({ params: idParamsSchema, body: completeTaskBodySchema }),
  completeTaskHandler,
)
recruitmentRouter.post(
  '/onboarding/:id/complete',
  requirePermission(PERMISSIONS.ONBOARDING_COMPLETE),
  validate({ params: idParamsSchema, body: completeOnboardingBodySchema }),
  completeOnboardingHandler,
)

recruitmentRouter.get(
  '/onboarding-templates',
  requirePermission(PERMISSIONS.ONBOARDING_VIEW),
  validate({ query: recruitmentSummaryQuerySchema }),
  listTemplatesHandler,
)
recruitmentRouter.post(
  '/onboarding-templates',
  requirePermission(PERMISSIONS.RECRUITMENT_MANAGE),
  validate({ body: createOnboardingTemplateBodySchema }),
  createTemplateHandler,
)

recruitmentRouter.get(
  '/reports/funnel',
  requirePermission(PERMISSIONS.RECRUITMENT_VIEW),
  validate({ query: recruitmentSummaryQuerySchema }),
  recruitmentFunnelReportHandler,
)
recruitmentRouter.get(
  '/reports/applications-by-source',
  requirePermission(PERMISSIONS.RECRUITMENT_VIEW),
  validate({ query: recruitmentSummaryQuerySchema }),
  applicationsBySourceReportHandler,
)
recruitmentRouter.get(
  '/reports/offers',
  requirePermission(PERMISSIONS.OFFER_VIEW),
  validate({ query: recruitmentSummaryQuerySchema }),
  offersSummaryReportHandler,
)
recruitmentRouter.get(
  '/reports/onboarding',
  requirePermission(PERMISSIONS.ONBOARDING_VIEW),
  validate({ query: recruitmentSummaryQuerySchema }),
  onboardingProgressReportHandler,
)
recruitmentRouter.get(
  '/reports/requisitions',
  requirePermission(PERMISSIONS.REQUISITION_VIEW),
  validate({ query: recruitmentSummaryQuerySchema }),
  openRequisitionsReportHandler,
)
recruitmentRouter.get(
  '/reports/candidates',
  requirePermission(PERMISSIONS.CANDIDATE_VIEW),
  validate({ query: recruitmentSummaryQuerySchema }),
  candidateVolumeReportHandler,
)
