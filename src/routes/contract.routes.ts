import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  activateContractHandler,
  amendPricingHandler,
  approveContractHandler,
  cancelContractHandler,
  completeContractHandler,
  convertFromBookingHandler,
  createContractHandler,
  extendContractHandler,
  getContractHandler,
  handoverHandler,
  listContractsHandler,
  quoteHandler,
  rejectContractHandler,
  replaceVehicleHandler,
  resumeContractHandler,
  returnHandler,
  signHandler,
  signatureCallbackHandler,
  submitContractHandler,
  suspendContractHandler,
  terminateContractHandler,
  termsHandler,
  updateContractHandler,
} from '../controllers/contracts/contract.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import { idParamsSchema } from '../validations/common.validation.js'
import {
  amendPricingBodySchema,
  createContractBodySchema,
  extendContractBodySchema,
  handoverBodySchema,
  listContractsQuerySchema,
  quoteQuerySchema,
  reasonBodySchema,
  replaceVehicleBodySchema,
  returnBodySchema,
  signatureBodySchema,
  signatureCallbackBodySchema,
  termsBodySchema,
  updateContractBodySchema,
} from '../validations/contract.validation.js'

export const contractRouter = Router()

contractRouter.use(authenticate)

contractRouter.get('/', requirePermission(PERMISSIONS.CONTRACT_VIEW), validate({ query: listContractsQuerySchema }), listContractsHandler)
contractRouter.get('/quote', requirePermission(PERMISSIONS.CONTRACT_VIEW), validate({ query: quoteQuerySchema }), quoteHandler)
contractRouter.post('/', requirePermission(PERMISSIONS.CONTRACT_CREATE), validate({ body: createContractBodySchema }), createContractHandler)
contractRouter.post(
  '/from-booking/:id',
  requirePermission(PERMISSIONS.CONTRACT_CREATE),
  validate({ params: idParamsSchema }),
  convertFromBookingHandler,
)
contractRouter.post(
  '/signatures/callback',
  requirePermission(PERMISSIONS.CONTRACT_UPDATE),
  validate({ body: signatureCallbackBodySchema }),
  signatureCallbackHandler,
)
contractRouter.get('/:id', requirePermission(PERMISSIONS.CONTRACT_VIEW), validate({ params: idParamsSchema }), getContractHandler)
contractRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.CONTRACT_UPDATE),
  validate({ params: idParamsSchema, body: updateContractBodySchema }),
  updateContractHandler,
)
contractRouter.post('/:id/submit', requirePermission(PERMISSIONS.CONTRACT_UPDATE), validate({ params: idParamsSchema }), submitContractHandler)
contractRouter.post('/:id/approve', requirePermission(PERMISSIONS.CONTRACT_APPROVE), validate({ params: idParamsSchema }), approveContractHandler)
contractRouter.post(
  '/:id/reject',
  requirePermission(PERMISSIONS.CONTRACT_APPROVE),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  rejectContractHandler,
)
contractRouter.post('/:id/activate', requirePermission(PERMISSIONS.CONTRACT_ACTIVATE), validate({ params: idParamsSchema }), activateContractHandler)
contractRouter.post('/:id/suspend', requirePermission(PERMISSIONS.CONTRACT_UPDATE), validate({ params: idParamsSchema }), suspendContractHandler)
contractRouter.post('/:id/resume', requirePermission(PERMISSIONS.CONTRACT_ACTIVATE), validate({ params: idParamsSchema }), resumeContractHandler)
contractRouter.post('/:id/complete', requirePermission(PERMISSIONS.CONTRACT_UPDATE), validate({ params: idParamsSchema }), completeContractHandler)
contractRouter.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.CONTRACT_CANCEL),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  cancelContractHandler,
)
contractRouter.post(
  '/:id/terminate',
  requirePermission(PERMISSIONS.CONTRACT_CANCEL),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  terminateContractHandler,
)
contractRouter.post(
  '/:id/extend',
  requirePermission(PERMISSIONS.CONTRACT_EXTEND),
  validate({ params: idParamsSchema, body: extendContractBodySchema }),
  extendContractHandler,
)
contractRouter.post(
  '/:id/amend-pricing',
  requirePermission(PERMISSIONS.CONTRACT_AMEND_PRICING),
  validate({ params: idParamsSchema, body: amendPricingBodySchema }),
  amendPricingHandler,
)
contractRouter.post(
  '/:id/replace-vehicle',
  requirePermission(PERMISSIONS.CONTRACT_REPLACE_VEHICLE),
  validate({ params: idParamsSchema, body: replaceVehicleBodySchema }),
  replaceVehicleHandler,
)
contractRouter.post(
  '/:id/handover',
  requirePermission(PERMISSIONS.CONTRACT_HANDOVER),
  validate({ params: idParamsSchema, body: handoverBodySchema }),
  handoverHandler,
)
contractRouter.post(
  '/:id/return',
  requirePermission(PERMISSIONS.CONTRACT_RETURN),
  validate({ params: idParamsSchema, body: returnBodySchema }),
  returnHandler,
)
contractRouter.post(
  '/:id/terms',
  requirePermission(PERMISSIONS.CONTRACT_UPDATE),
  validate({ params: idParamsSchema, body: termsBodySchema }),
  termsHandler,
)
contractRouter.post(
  '/:id/sign',
  requirePermission(PERMISSIONS.CONTRACT_UPDATE),
  validate({ params: idParamsSchema, body: signatureBodySchema }),
  signHandler,
)
