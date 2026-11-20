import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  createCalibrationHandler,
  createCycleHandler,
  createDevelopmentHandler,
  createFeedbackHandler,
  createFrameworkHandler,
  createGoalHandler,
  createKpiHandler,
  createOneOnOneHandler,
  createPipHandler,
  createRatingScaleHandler,
  createRecognitionHandler,
  createReviewHandler,
  createSuccessionHandler,
  createTemplateHandler,
  createTrainingHandler,
  finalizeCalibrationHandler,
  finalizeReviewHandler,
  getCycleHandler,
  getGoalHandler,
  getPipHandler,
  getReviewHandler,
  listCalibrationsHandler,
  listCyclesHandler,
  listDevelopmentHandler,
  listFeedbackHandler,
  listFrameworksHandler,
  listGoalsHandler,
  listKpisHandler,
  listOneOnOnesHandler,
  listPeerHandler,
  listPipsHandler,
  listRatingScalesHandler,
  listRecognitionsHandler,
  listReviewsHandler,
  listSuccessionHandler,
  listTemplatesHandler,
  managerAssessmentHandler,
  performanceAnalyticsHandler,
  performanceSummaryHandler,
  requestPeerHandler,
  selfAssessmentHandler,
  submitPeerHandler,
  transitionCycleHandler,
  transitionReviewHandler,
  updateGoalHandler,
  updatePipHandler,
  validateGoalWeightsHandler,
} from '../controllers/performance/performance.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import { idParamsSchema } from '../validations/common.validation.js'
import {
  createCalibrationBodySchema,
  createCycleBodySchema,
  createDevelopmentPlanBodySchema,
  createFeedbackBodySchema,
  createFrameworkBodySchema,
  createGoalBodySchema,
  createKpiBodySchema,
  createOneOnOneBodySchema,
  createPipBodySchema,
  createRatingScaleBodySchema,
  createRecognitionBodySchema,
  createReviewBodySchema,
  createSuccessionBodySchema,
  createTemplateBodySchema,
  createTrainingRecommendationBodySchema,
  cycleTransitionBodySchema,
  finalizeCalibrationBodySchema,
  finalizeReviewBodySchema,
  listPerformanceQuerySchema,
  managerAssessmentBodySchema,
  peerRequestBodySchema,
  peerSubmitBodySchema,
  performanceSummaryQuerySchema,
  reviewTransitionBodySchema,
  selfAssessmentBodySchema,
  updateGoalProgressBodySchema,
  updatePipBodySchema,
} from '../validations/performance.validation.js'
import { z } from 'zod'
import { objectIdSchema } from '../validations/common.validation.js'

export const performanceRouter = Router()
performanceRouter.use(authenticate)

performanceRouter.get(
  '/summary',
  requirePermission(PERMISSIONS.PERFORMANCE_ANALYTICS_VIEW),
  validate({ query: performanceSummaryQuerySchema }),
  performanceSummaryHandler,
)
performanceRouter.get(
  '/analytics',
  requirePermission(PERMISSIONS.PERFORMANCE_ANALYTICS_VIEW),
  validate({ query: performanceSummaryQuerySchema }),
  performanceAnalyticsHandler,
)

performanceRouter.get(
  '/rating-scales',
  requirePermission(PERMISSIONS.PERFORMANCE_CYCLE_VIEW),
  validate({ query: performanceSummaryQuerySchema }),
  listRatingScalesHandler,
)
performanceRouter.post(
  '/rating-scales',
  requirePermission(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE),
  validate({ body: createRatingScaleBodySchema }),
  createRatingScaleHandler,
)

performanceRouter.get(
  '/templates',
  requirePermission(PERMISSIONS.PERFORMANCE_CYCLE_VIEW),
  validate({ query: performanceSummaryQuerySchema }),
  listTemplatesHandler,
)
performanceRouter.post(
  '/templates',
  requirePermission(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE),
  validate({ body: createTemplateBodySchema }),
  createTemplateHandler,
)

performanceRouter.get(
  '/cycles',
  requirePermission(PERMISSIONS.PERFORMANCE_CYCLE_VIEW),
  validate({ query: listPerformanceQuerySchema }),
  listCyclesHandler,
)
performanceRouter.post(
  '/cycles',
  requirePermission(PERMISSIONS.PERFORMANCE_CYCLE_CREATE),
  validate({ body: createCycleBodySchema }),
  createCycleHandler,
)
performanceRouter.get(
  '/cycles/:id',
  requirePermission(PERMISSIONS.PERFORMANCE_CYCLE_VIEW),
  validate({ params: idParamsSchema }),
  getCycleHandler,
)
performanceRouter.post(
  '/cycles/:id/transition',
  requirePermission(PERMISSIONS.PERFORMANCE_CYCLE_UPDATE),
  validate({ params: idParamsSchema, body: cycleTransitionBodySchema }),
  transitionCycleHandler,
)

performanceRouter.get(
  '/goals',
  requirePermission(PERMISSIONS.PERFORMANCE_GOAL_VIEW),
  validate({ query: listPerformanceQuerySchema }),
  listGoalsHandler,
)
performanceRouter.post(
  '/goals',
  requirePermission(PERMISSIONS.PERFORMANCE_GOAL_CREATE),
  validate({ body: createGoalBodySchema }),
  createGoalHandler,
)
performanceRouter.get(
  '/goals/validate-weights',
  requirePermission(PERMISSIONS.PERFORMANCE_GOAL_VIEW),
  validate({
    query: z.object({ cycleId: objectIdSchema, employeeId: objectIdSchema }),
  }),
  validateGoalWeightsHandler,
)
performanceRouter.get(
  '/goals/:id',
  requirePermission(PERMISSIONS.PERFORMANCE_GOAL_VIEW),
  validate({ params: idParamsSchema }),
  getGoalHandler,
)
performanceRouter.patch(
  '/goals/:id',
  requirePermission(PERMISSIONS.PERFORMANCE_GOAL_UPDATE),
  validate({ params: idParamsSchema, body: updateGoalProgressBodySchema }),
  updateGoalHandler,
)

performanceRouter.get(
  '/reviews',
  requirePermission(PERMISSIONS.PERFORMANCE_REVIEW_VIEW_SELF),
  validate({ query: listPerformanceQuerySchema }),
  listReviewsHandler,
)
performanceRouter.post(
  '/reviews',
  requirePermission(PERMISSIONS.PERFORMANCE_REVIEW_CREATE),
  validate({ body: createReviewBodySchema }),
  createReviewHandler,
)
performanceRouter.get(
  '/reviews/:id',
  requirePermission(PERMISSIONS.PERFORMANCE_REVIEW_VIEW_SELF),
  validate({ params: idParamsSchema }),
  getReviewHandler,
)
performanceRouter.post(
  '/reviews/:id/self-assessment',
  requirePermission(PERMISSIONS.PERFORMANCE_REVIEW_SUBMIT),
  validate({ params: idParamsSchema, body: selfAssessmentBodySchema }),
  selfAssessmentHandler,
)
performanceRouter.post(
  '/reviews/:id/manager-assessment',
  requirePermission(PERMISSIONS.PERFORMANCE_REVIEW_SUBMIT),
  validate({ params: idParamsSchema, body: managerAssessmentBodySchema }),
  managerAssessmentHandler,
)
performanceRouter.post(
  '/reviews/:id/peer-requests',
  requirePermission(PERMISSIONS.PERFORMANCE_REVIEW_CREATE),
  validate({ params: idParamsSchema, body: peerRequestBodySchema }),
  requestPeerHandler,
)
performanceRouter.get(
  '/reviews/:id/peer-reviews',
  requirePermission(PERMISSIONS.PERFORMANCE_REVIEW_VIEW_TEAM),
  validate({ params: idParamsSchema }),
  listPeerHandler,
)
performanceRouter.post(
  '/peer-reviews/:id/submit',
  requirePermission(PERMISSIONS.PERFORMANCE_REVIEW_SUBMIT),
  validate({ params: idParamsSchema, body: peerSubmitBodySchema }),
  submitPeerHandler,
)
performanceRouter.post(
  '/reviews/:id/finalize',
  requirePermission(PERMISSIONS.PERFORMANCE_REVIEW_FINALIZE),
  validate({ params: idParamsSchema, body: finalizeReviewBodySchema }),
  finalizeReviewHandler,
)
performanceRouter.post(
  '/reviews/:id/transition',
  requirePermission(PERMISSIONS.PERFORMANCE_REVIEW_SUBMIT),
  validate({ params: idParamsSchema, body: reviewTransitionBodySchema }),
  transitionReviewHandler,
)

performanceRouter.get(
  '/calibrations',
  requirePermission(PERMISSIONS.PERFORMANCE_CALIBRATION_VIEW),
  validate({ query: performanceSummaryQuerySchema }),
  listCalibrationsHandler,
)
performanceRouter.post(
  '/calibrations',
  requirePermission(PERMISSIONS.PERFORMANCE_CALIBRATION_MANAGE),
  validate({ body: createCalibrationBodySchema }),
  createCalibrationHandler,
)
performanceRouter.post(
  '/calibrations/:id/finalize',
  requirePermission(PERMISSIONS.PERFORMANCE_CALIBRATION_MANAGE),
  validate({ params: idParamsSchema, body: finalizeCalibrationBodySchema }),
  finalizeCalibrationHandler,
)

performanceRouter.get(
  '/pips',
  requirePermission(PERMISSIONS.PERFORMANCE_PIP_VIEW),
  validate({ query: listPerformanceQuerySchema }),
  listPipsHandler,
)
performanceRouter.post(
  '/pips',
  requirePermission(PERMISSIONS.PERFORMANCE_PIP_CREATE),
  validate({ body: createPipBodySchema }),
  createPipHandler,
)
performanceRouter.get(
  '/pips/:id',
  requirePermission(PERMISSIONS.PERFORMANCE_PIP_VIEW),
  validate({ params: idParamsSchema }),
  getPipHandler,
)
performanceRouter.patch(
  '/pips/:id',
  requirePermission(PERMISSIONS.PERFORMANCE_PIP_MANAGE),
  validate({ params: idParamsSchema, body: updatePipBodySchema }),
  updatePipHandler,
)

performanceRouter.get(
  '/one-on-ones',
  requirePermission(PERMISSIONS.PERFORMANCE_FEEDBACK_VIEW),
  validate({ query: listPerformanceQuerySchema }),
  listOneOnOnesHandler,
)
performanceRouter.post(
  '/one-on-ones',
  requirePermission(PERMISSIONS.PERFORMANCE_FEEDBACK_CREATE),
  validate({ body: createOneOnOneBodySchema }),
  createOneOnOneHandler,
)

performanceRouter.get(
  '/feedback',
  requirePermission(PERMISSIONS.PERFORMANCE_FEEDBACK_VIEW),
  validate({ query: listPerformanceQuerySchema }),
  listFeedbackHandler,
)
performanceRouter.post(
  '/feedback',
  requirePermission(PERMISSIONS.PERFORMANCE_FEEDBACK_CREATE),
  validate({ body: createFeedbackBodySchema }),
  createFeedbackHandler,
)

performanceRouter.get(
  '/recognitions',
  requirePermission(PERMISSIONS.PERFORMANCE_FEEDBACK_VIEW),
  validate({ query: listPerformanceQuerySchema }),
  listRecognitionsHandler,
)
performanceRouter.post(
  '/recognitions',
  requirePermission(PERMISSIONS.PERFORMANCE_FEEDBACK_CREATE),
  validate({ body: createRecognitionBodySchema }),
  createRecognitionHandler,
)

performanceRouter.get(
  '/development-plans',
  requirePermission(PERMISSIONS.PERFORMANCE_DEVELOPMENT_VIEW),
  validate({ query: listPerformanceQuerySchema }),
  listDevelopmentHandler,
)
performanceRouter.post(
  '/development-plans',
  requirePermission(PERMISSIONS.PERFORMANCE_DEVELOPMENT_MANAGE),
  validate({ body: createDevelopmentPlanBodySchema }),
  createDevelopmentHandler,
)

performanceRouter.get(
  '/frameworks',
  requirePermission(PERMISSIONS.PERFORMANCE_CYCLE_VIEW),
  validate({ query: performanceSummaryQuerySchema }),
  listFrameworksHandler,
)
performanceRouter.post(
  '/frameworks',
  requirePermission(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE),
  validate({ body: createFrameworkBodySchema }),
  createFrameworkHandler,
)

performanceRouter.get(
  '/kpis',
  requirePermission(PERMISSIONS.PERFORMANCE_CYCLE_VIEW),
  validate({ query: performanceSummaryQuerySchema }),
  listKpisHandler,
)
performanceRouter.post(
  '/kpis',
  requirePermission(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE),
  validate({ body: createKpiBodySchema }),
  createKpiHandler,
)

performanceRouter.post(
  '/training-recommendations',
  requirePermission(PERMISSIONS.PERFORMANCE_DEVELOPMENT_MANAGE),
  validate({ body: createTrainingRecommendationBodySchema }),
  createTrainingHandler,
)

performanceRouter.get(
  '/succession',
  requirePermission(PERMISSIONS.PERFORMANCE_SUCCESSION_VIEW),
  validate({ query: performanceSummaryQuerySchema }),
  listSuccessionHandler,
)
performanceRouter.post(
  '/succession',
  requirePermission(PERMISSIONS.PERFORMANCE_SUCCESSION_MANAGE),
  validate({ body: createSuccessionBodySchema }),
  createSuccessionHandler,
)
