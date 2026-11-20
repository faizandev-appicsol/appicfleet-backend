import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  archiveDocumentHandler,
  changeCustomerStatusHandler,
  createContactHandler,
  createCustomerHandler,
  deactivateContactHandler,
  downloadDocumentHandler,
  getCustomerHandler,
  listContactsHandler,
  listCustomersHandler,
  listDocumentsHandler,
  listDuplicatesHandler,
  listOcrRunsHandler,
  reviewDuplicateHandler,
  reviewOcrHandler,
  startOcrHandler,
  updateContactHandler,
  updateCustomerHandler,
  uploadDocumentHandler,
} from '../controllers/customers/customer.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import {
  changeCustomerStatusBodySchema,
  createCustomerBodySchema,
  createCustomerContactBodySchema,
  customerContactParamsSchema,
  customerDocumentParamsSchema,
  documentContentQuerySchema,
  customerDuplicateParamsSchema,
  customerIdParamsSchema,
  customerOcrRunParamsSchema,
  customerRevealQuerySchema,
  listCustomerContactsQuerySchema,
  listCustomerDocumentsQuerySchema,
  listCustomerDuplicatesQuerySchema,
  listCustomersQuerySchema,
  listOcrRunsQuerySchema,
  reviewDuplicateBodySchema,
  reviewOcrBodySchema,
  updateCustomerBodySchema,
  updateCustomerContactBodySchema,
  uploadCustomerDocumentBodySchema,
} from '../validations/customer.validation.js'

export const customerRouter = Router()

customerRouter.use(authenticate)

customerRouter.get(
  '/',
  requirePermission(PERMISSIONS.CUSTOMER_VIEW),
  validate({ query: listCustomersQuerySchema }),
  listCustomersHandler,
)
customerRouter.post(
  '/',
  requirePermission(PERMISSIONS.CUSTOMER_CREATE),
  validate({ body: createCustomerBodySchema }),
  createCustomerHandler,
)
customerRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMER_VIEW),
  validate({ query: customerRevealQuerySchema, params: customerIdParamsSchema }),
  getCustomerHandler,
)
customerRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate({ body: updateCustomerBodySchema, params: customerIdParamsSchema }),
  updateCustomerHandler,
)
// The permission depends on the target status (customer.deactivate or customer.update), so it is
// enforced inside the service after the customer has been loaded.
customerRouter.post(
  '/:id/status',
  validate({ body: changeCustomerStatusBodySchema, params: customerIdParamsSchema }),
  changeCustomerStatusHandler,
)

customerRouter.get(
  '/:id/contacts',
  requirePermission(PERMISSIONS.CUSTOMER_VIEW),
  validate({ query: listCustomerContactsQuerySchema, params: customerIdParamsSchema }),
  listContactsHandler,
)
customerRouter.post(
  '/:id/contacts',
  requirePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate({ body: createCustomerContactBodySchema, params: customerIdParamsSchema }),
  createContactHandler,
)
customerRouter.patch(
  '/:id/contacts/:contactId',
  requirePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate({ body: updateCustomerContactBodySchema, params: customerContactParamsSchema }),
  updateContactHandler,
)
customerRouter.post(
  '/:id/contacts/:contactId/deactivate',
  requirePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate({ params: customerContactParamsSchema }),
  deactivateContactHandler,
)

customerRouter.get(
  '/:id/documents',
  requirePermission(PERMISSIONS.CUSTOMER_VIEW),
  validate({ query: listCustomerDocumentsQuerySchema, params: customerIdParamsSchema }),
  listDocumentsHandler,
)
// The body limit for this route is raised in app.ts (the only place it is).
customerRouter.post(
  '/:id/documents',
  requirePermission(PERMISSIONS.CUSTOMER_UPLOAD_DOCUMENTS),
  validate({ body: uploadCustomerDocumentBodySchema, params: customerIdParamsSchema }),
  uploadDocumentHandler,
)
customerRouter.get(
  '/:id/documents/:documentId/content',
  requirePermission(PERMISSIONS.CUSTOMER_VIEW_SENSITIVE),
  validate({ query: documentContentQuerySchema, params: customerDocumentParamsSchema }),
  downloadDocumentHandler,
)
customerRouter.post(
  '/:id/documents/:documentId/archive',
  requirePermission(PERMISSIONS.CUSTOMER_MANAGE_DOCUMENTS),
  validate({ params: customerDocumentParamsSchema }),
  archiveDocumentHandler,
)

customerRouter.post(
  '/:id/documents/:documentId/ocr',
  requirePermission(PERMISSIONS.CUSTOMER_REVIEW_OCR),
  validate({ params: customerDocumentParamsSchema }),
  startOcrHandler,
)
customerRouter.get(
  '/:id/documents/:documentId/ocr',
  requirePermission(PERMISSIONS.CUSTOMER_VIEW),
  validate({ query: listOcrRunsQuerySchema, params: customerDocumentParamsSchema }),
  listOcrRunsHandler,
)
customerRouter.post(
  '/:id/documents/:documentId/ocr/:runId/review',
  requirePermission(PERMISSIONS.CUSTOMER_REVIEW_OCR),
  validate({ body: reviewOcrBodySchema, params: customerOcrRunParamsSchema }),
  reviewOcrHandler,
)

customerRouter.get(
  '/:id/duplicates',
  requirePermission(PERMISSIONS.CUSTOMER_REVIEW_DUPLICATES),
  validate({ query: listCustomerDuplicatesQuerySchema, params: customerIdParamsSchema }),
  listDuplicatesHandler,
)
customerRouter.post(
  '/:id/duplicates/:reviewId',
  requirePermission(PERMISSIONS.CUSTOMER_REVIEW_DUPLICATES),
  validate({ body: reviewDuplicateBodySchema, params: customerDuplicateParamsSchema }),
  reviewDuplicateHandler,
)
