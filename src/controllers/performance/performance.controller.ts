import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  createCompetencyFramework,
  createDevelopmentPlan,
  createFeedback,
  createKpiDefinition,
  createOneOnOne,
  createPip,
  createRecognition,
  createSuccessionPlan,
  createTrainingRecommendation,
  getPip,
  listDevelopmentPlansService,
  listFeedbackService,
  listFrameworksService,
  listKpisService,
  listOneOnOnesService,
  listPipsService,
  listRecognitionsService,
  listSuccessionPlansService,
  updatePipService,
} from '../../services/performance/coaching.service.js'
import {
  createCycle,
  createRatingScale,
  createTemplate,
  getCycle,
  listCyclesService,
  listRatingScalesService,
  listTemplatesService,
  transitionCycle,
} from '../../services/performance/cycle.service.js'
import {
  createGoal,
  getGoal,
  listGoalsService,
  updateGoalProgress,
  validateCycleGoalWeights,
} from '../../services/performance/goal.service.js'
import {
  createCalibrationSession,
  createReview,
  finalizeCalibration,
  finalizeReview,
  getReviewAuthorized,
  listCalibrationsService,
  listPeerReviewsForReview,
  listReviewsService,
  requestPeerReview,
  submitManagerAssessment,
  submitPeerReview,
  submitSelfAssessment,
  transitionReviewStatus,
} from '../../services/performance/review.service.js'
import {
  performanceAnalytics,
  performanceDashboard,
} from '../../services/performance/summary.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'

export const performanceSummaryHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Performance summary loaded.',
    await performanceDashboard(requireAccess(req), query),
  )
})

export const performanceAnalyticsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Performance analytics loaded.',
    await performanceAnalytics(requireAccess(req), query),
  )
})

export const createRatingScaleHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Rating scale created.',
    await createRatingScale(requireAccess(req), body as never),
    201,
  )
})

export const listRatingScalesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string }>>(req)
  sendSuccess(
    res,
    'Rating scales loaded.',
    await listRatingScalesService(requireAccess(req), query.organizationId),
  )
})

export const createTemplateHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Template created.',
    await createTemplate(requireAccess(req), body as never),
    201,
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

export const createCycleHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Performance cycle created.',
    await createCycle(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const listCyclesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Cycles loaded.', await listCyclesService(requireAccess(req), query as never))
})

export const getCycleHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Cycle loaded.', await getCycle(requireAccess(req), params.id))
})

export const transitionCycleHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<{ status: string }, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Cycle status updated.',
    await transitionCycle(requireAccess(req), params.id, body.status, getRequestMeta(req)),
  )
})

export const createGoalHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Goal created.',
    await createGoal(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const listGoalsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Goals loaded.', await listGoalsService(requireAccess(req), query as never))
})

export const getGoalHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Goal loaded.', await getGoal(requireAccess(req), params.id))
})

export const updateGoalHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Goal updated.',
    await updateGoalProgress(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const validateGoalWeightsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<
    ValidatedRequest<unknown, { cycleId: string; employeeId: string }>
  >(req)
  sendSuccess(
    res,
    'Goal weights validated.',
    await validateCycleGoalWeights(requireAccess(req), query.cycleId, query.employeeId),
  )
})

export const createReviewHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Review created.',
    await createReview(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const listReviewsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Reviews loaded.', await listReviewsService(requireAccess(req), query as never))
})

export const getReviewHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Review loaded.', await getReviewAuthorized(requireAccess(req), params.id))
})

export const selfAssessmentHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Self-assessment submitted.',
    await submitSelfAssessment(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const managerAssessmentHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Manager assessment submitted.',
    await submitManagerAssessment(
      requireAccess(req),
      params.id,
      body as never,
      getRequestMeta(req),
    ),
  )
})

export const requestPeerHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Peer review requested.',
    await requestPeerReview(requireAccess(req), params.id, body as never),
    201,
  )
})

export const listPeerHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Peer reviews loaded.',
    await listPeerReviewsForReview(requireAccess(req), params.id),
  )
})

export const submitPeerHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Peer review submitted.',
    await submitPeerReview(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const finalizeReviewHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Review finalized.',
    await finalizeReview(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const transitionReviewHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<{ status: string }, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Review status updated.',
    await transitionReviewStatus(
      requireAccess(req),
      params.id,
      body.status,
      getRequestMeta(req),
    ),
  )
})

export const createCalibrationHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Calibration session created.',
    await createCalibrationSession(requireAccess(req), body as never),
    201,
  )
})

export const listCalibrationsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Calibration sessions loaded.',
    await listCalibrationsService(requireAccess(req), query as never),
  )
})

export const finalizeCalibrationHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Calibration finalized.',
    await finalizeCalibration(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const createPipHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'PIP created.',
    await createPip(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const listPipsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'PIPs loaded.', await listPipsService(requireAccess(req), query as never))
})

export const getPipHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'PIP loaded.', await getPip(requireAccess(req), params.id))
})

export const updatePipHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'PIP updated.',
    await updatePipService(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const createOneOnOneHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'One-on-one created.',
    await createOneOnOne(requireAccess(req), body as never),
    201,
  )
})

export const listOneOnOnesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'One-on-ones loaded.',
    await listOneOnOnesService(requireAccess(req), query as never),
  )
})

export const createFeedbackHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Feedback created.',
    await createFeedback(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const listFeedbackHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Feedback loaded.',
    await listFeedbackService(requireAccess(req), query as never),
  )
})

export const createRecognitionHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Recognition created.',
    await createRecognition(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const listRecognitionsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Recognition loaded.',
    await listRecognitionsService(requireAccess(req), query as never),
  )
})

export const createDevelopmentHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Development plan created.',
    await createDevelopmentPlan(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const listDevelopmentHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Development plans loaded.',
    await listDevelopmentPlansService(requireAccess(req), query as never),
  )
})

export const createFrameworkHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Competency framework created.',
    await createCompetencyFramework(requireAccess(req), body as never),
    201,
  )
})

export const listFrameworksHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string }>>(req)
  sendSuccess(
    res,
    'Frameworks loaded.',
    await listFrameworksService(requireAccess(req), query.organizationId),
  )
})

export const createKpiHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'KPI created.',
    await createKpiDefinition(requireAccess(req), body as never),
    201,
  )
})

export const listKpisHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string }>>(req)
  sendSuccess(res, 'KPIs loaded.', await listKpisService(requireAccess(req), query.organizationId))
})

export const createTrainingHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Training recommendation created.',
    await createTrainingRecommendation(requireAccess(req), body as never),
    201,
  )
})

export const createSuccessionHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Succession plan created.',
    await createSuccessionPlan(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const listSuccessionHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string }>>(req)
  sendSuccess(
    res,
    'Succession plans loaded.',
    await listSuccessionPlansService(requireAccess(req), query.organizationId),
  )
})
