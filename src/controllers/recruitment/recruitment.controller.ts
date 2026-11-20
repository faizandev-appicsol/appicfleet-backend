import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  changeApplicationStage,
  getApplication,
  listApplicationsService,
  listPipelineStagesService,
} from '../../services/recruitment/application.service.js'
import {
  addCandidateNote,
  createApplication,
  createCandidate,
  getCandidate,
  listCandidateActivityService,
  listCandidateDocumentsService,
  listCandidatesService,
  registerCandidateDocument,
  updateCandidateService,
} from '../../services/recruitment/candidate.service.js'
import {
  completeOnboarding,
  completeOnboardingTask,
  convertOfferToEmployee,
  createOnboardingTemplate,
  getOnboarding,
  listOnboardingsService,
  listTemplatesService,
} from '../../services/recruitment/hiring.service.js'
import {
  cancelInterview,
  completeInterview,
  getInterview,
  listFeedbackService,
  listInterviewsService,
  rescheduleInterview,
  scheduleInterview,
  submitFeedback,
} from '../../services/recruitment/interview.service.js'
import {
  approveOffer,
  createOffer,
  generateOfferLetterPreview,
  getOffer,
  listOffersService,
  respondToOfferWithToken,
  sendOffer,
  staffRespondToOffer,
  submitOfferForApproval,
} from '../../services/recruitment/offer.service.js'
import {
  approveRequisition,
  createPostingFromRequisition,
  createRequisition,
  getRequisition,
  listPostingsService,
  listRequisitionsService,
  publishPosting,
  submitRequisitionForApproval,
  transitionRequisition,
  updateRequisitionDraft,
} from '../../services/recruitment/requisition.service.js'
import {
  applicationsBySourceReport,
  candidateVolumeReport,
  offersSummaryReport,
  onboardingProgressReport,
  openRequisitionsReport,
  recruitmentFunnelReport,
} from '../../services/recruitment/reports.service.js'
import { recruitmentDashboard } from '../../services/recruitment/summary.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'

export const recruitmentSummaryHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Recruitment summary loaded.',
    await recruitmentDashboard(requireAccess(req), query),
  )
})

export const listRequisitionsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Requisitions loaded.',
    await listRequisitionsService(requireAccess(req), query as never),
  )
})

export const createRequisitionHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Requisition created.',
    await createRequisition(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const getRequisitionHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Requisition loaded.', await getRequisition(requireAccess(req), params.id))
})

export const updateRequisitionHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Requisition updated.',
    await updateRequisitionDraft(requireAccess(req), params.id, body),
  )
})

export const submitRequisitionHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Requisition submitted.',
    await submitRequisitionForApproval(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const approveRequisitionHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Requisition reviewed.',
    await approveRequisition(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const transitionRequisitionHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<{ status: string }, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Requisition status updated.',
    await transitionRequisition(requireAccess(req), params.id, body.status, getRequestMeta(req)),
  )
})

export const listPostingsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Postings loaded.', await listPostingsService(requireAccess(req), query as never))
})

export const createPostingHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Posting created.',
    await createPostingFromRequisition(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const publishPostingHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Posting published.', await publishPosting(requireAccess(req), params.id))
})

export const listCandidatesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Candidates loaded.',
    await listCandidatesService(requireAccess(req), query as never),
  )
})

export const createCandidateHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Candidate processed.',
    await createCandidate(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const getCandidateHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Candidate loaded.', await getCandidate(requireAccess(req), params.id))
})

export const updateCandidateHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Candidate updated.',
    await updateCandidateService(requireAccess(req), params.id, body, getRequestMeta(req)),
  )
})

export const candidateNoteHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Note added.',
    await addCandidateNote(requireAccess(req), params.id, body as never),
    201,
  )
})

export const candidateActivityHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Activity loaded.',
    await listCandidateActivityService(requireAccess(req), params.id),
  )
})

export const candidateDocumentHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Document registered.',
    await registerCandidateDocument(
      requireAccess(req),
      params.id,
      body as never,
      getRequestMeta(req),
    ),
    201,
  )
})

export const listCandidateDocumentsHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Documents loaded.',
    await listCandidateDocumentsService(requireAccess(req), params.id),
  )
})

export const listApplicationsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Applications loaded.',
    await listApplicationsService(requireAccess(req), query as never),
  )
})

export const createApplicationHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Application created.',
    await createApplication(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const getApplicationHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Application loaded.', await getApplication(requireAccess(req), params.id))
})

export const changeStageHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Application stage updated.',
    await changeApplicationStage(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const listStagesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string }>>(req)
  sendSuccess(
    res,
    'Stages loaded.',
    await listPipelineStagesService(requireAccess(req), query.organizationId),
  )
})

export const listInterviewsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Interviews loaded.',
    await listInterviewsService(requireAccess(req), query as never),
  )
})

export const scheduleInterviewHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Interview scheduled.',
    await scheduleInterview(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const getInterviewHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Interview loaded.', await getInterview(requireAccess(req), params.id))
})

export const rescheduleInterviewHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Interview rescheduled.',
    await rescheduleInterview(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const completeInterviewHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Interview completed.',
    await completeInterview(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const cancelInterviewHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Interview cancelled.', await cancelInterview(requireAccess(req), params.id))
})

export const submitFeedbackHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Feedback submitted.',
    await submitFeedback(requireAccess(req), params.id, body as never, getRequestMeta(req)),
    201,
  )
})

export const listFeedbackHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Feedback loaded.', await listFeedbackService(requireAccess(req), params.id))
})

export const listOffersHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Offers loaded.', await listOffersService(requireAccess(req), query as never))
})

export const createOfferHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Offer created.',
    await createOffer(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const getOfferHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Offer loaded.', await getOffer(requireAccess(req), params.id))
})

export const submitOfferHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Offer submitted.', await submitOfferForApproval(requireAccess(req), params.id))
})

export const approveOfferHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Offer reviewed.',
    await approveOffer(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const sendOfferHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Offer sent.',
    await sendOffer(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const staffOfferResponseHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Offer response recorded.',
    await staffRespondToOffer(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const offerLetterHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Offer letter preview loaded.',
    await generateOfferLetterPreview(requireAccess(req), params.id),
  )
})

export const candidateOfferTokenHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<
    ValidatedRequest<{ token: string; accept: boolean; notes?: string }>
  >(req)
  sendSuccess(
    res,
    'Offer response recorded.',
    await respondToOfferWithToken(body.token, { accept: body.accept, notes: body.notes }),
  )
})

export const convertHireHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Candidate converted.',
    await convertOfferToEmployee(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const listOnboardingsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Onboarding loaded.',
    await listOnboardingsService(requireAccess(req), query as never),
  )
})

export const getOnboardingHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Onboarding loaded.', await getOnboarding(requireAccess(req), params.id))
})

export const completeTaskHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Task completed.',
    await completeOnboardingTask(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const completeOnboardingHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Onboarding completed.',
    await completeOnboarding(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const listTemplatesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string }>>(req)
  sendSuccess(
    res,
    'Templates loaded.',
    await listTemplatesService(requireAccess(req), query.organizationId),
  )
})

export const createTemplateHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Template created.',
    await createOnboardingTemplate(requireAccess(req), body as never),
    201,
  )
})

export const recruitmentFunnelReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string }>>(req)
  sendSuccess(
    res,
    'Hiring funnel report loaded.',
    await recruitmentFunnelReport(requireAccess(req), query),
  )
})

export const applicationsBySourceReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string }>>(req)
  sendSuccess(
    res,
    'Applications by source report loaded.',
    await applicationsBySourceReport(requireAccess(req), query),
  )
})

export const offersSummaryReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string }>>(req)
  sendSuccess(
    res,
    'Offers summary report loaded.',
    await offersSummaryReport(requireAccess(req), query),
  )
})

export const onboardingProgressReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string }>>(req)
  sendSuccess(
    res,
    'Onboarding progress report loaded.',
    await onboardingProgressReport(requireAccess(req), query),
  )
})

export const openRequisitionsReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string }>>(req)
  sendSuccess(
    res,
    'Open requisitions report loaded.',
    await openRequisitionsReport(requireAccess(req), query),
  )
})

export const candidateVolumeReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string }>>(req)
  sendSuccess(
    res,
    'Candidate volume report loaded.',
    await candidateVolumeReport(requireAccess(req), query),
  )
})
