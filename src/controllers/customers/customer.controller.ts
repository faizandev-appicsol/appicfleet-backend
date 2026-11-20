import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  changeContact,
  createContact,
  deactivateContact,
  listContacts,
} from '../../services/customers/contact.service.js'
import {
  addCustomer,
  changeCustomer,
  changeCustomerStatus,
  getCustomer,
  listCustomerDirectory,
} from '../../services/customers/customer.service.js'
import {
  archiveDocument,
  downloadDocument,
  listDocuments,
  uploadDocument,
} from '../../services/customers/document.service.js'
import {
  listCustomerDuplicates,
  reviewCustomerDuplicate,
} from '../../services/customers/duplicate.service.js'
import { listDocumentOcrRuns, reviewOcr, startOcr } from '../../services/customers/ocr.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type {
  ChangeCustomerStatusBody,
  CreateCustomerBody,
  CreateCustomerContactBody,
  CustomerContactParams,
  CustomerDocumentParams,
  DocumentContentQuery,
  CustomerDuplicateParams,
  CustomerIdParams,
  CustomerOcrRunParams,
  CustomerRevealQuery,
  ListCustomerContactsQuery,
  ListCustomerDocumentsQuery,
  ListCustomerDuplicatesQuery,
  ListCustomersQuery,
  ListOcrRunsQuery,
  ReviewDuplicateBody,
  ReviewOcrBody,
  UpdateCustomerBody,
  UpdateCustomerContactBody,
  UploadCustomerDocumentBody,
} from '../../validations/customer.validation.js'

export const listCustomersHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListCustomersQuery>>(req)
  const result = await listCustomerDirectory(requireAccess(req), query)
  sendSuccess(res, 'Customers retrieved successfully.', result)
})

export const createCustomerHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateCustomerBody>>(req)
  const customer = await addCustomer(requireAccess(req), body, getRequestMeta(req))
  sendSuccess(res, 'Customer created successfully.', customer, 201)
})

export const getCustomerHandler = asyncHandler(async (req, res) => {
  const { query, params } =
    getValidated<ValidatedRequest<unknown, CustomerRevealQuery, CustomerIdParams>>(req)
  const customer = await getCustomer(requireAccess(req), params.id, query.reveal)
  sendSuccess(res, 'Customer retrieved successfully.', customer)
})

export const updateCustomerHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<UpdateCustomerBody, unknown, CustomerIdParams>>(req)
  const customer = await changeCustomer(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Customer updated successfully.', customer)
})

export const changeCustomerStatusHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<ChangeCustomerStatusBody, unknown, CustomerIdParams>>(req)
  const customer = await changeCustomerStatus(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Customer status updated successfully.', customer)
})

// Contacts ------------------------------------------------------------------------------------

export const listContactsHandler = asyncHandler(async (req, res) => {
  const { query, params } =
    getValidated<ValidatedRequest<unknown, ListCustomerContactsQuery, CustomerIdParams>>(req)
  const result = await listContacts(requireAccess(req), params.id, query)
  sendSuccess(res, 'Customer contacts retrieved successfully.', result)
})

export const createContactHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<CreateCustomerContactBody, unknown, CustomerIdParams>>(req)
  const contact = await createContact(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Customer contact created successfully.', contact, 201)
})

export const updateContactHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<UpdateCustomerContactBody, unknown, CustomerContactParams>>(req)
  const contact = await changeContact(requireAccess(req), params, body, getRequestMeta(req))
  sendSuccess(res, 'Customer contact updated successfully.', contact)
})

export const deactivateContactHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerContactParams>>(req)
  const contact = await deactivateContact(requireAccess(req), params, getRequestMeta(req))
  sendSuccess(res, 'Customer contact deactivated successfully.', contact)
})

// Documents -----------------------------------------------------------------------------------

export const listDocumentsHandler = asyncHandler(async (req, res) => {
  const { query, params } =
    getValidated<ValidatedRequest<unknown, ListCustomerDocumentsQuery, CustomerIdParams>>(req)
  const result = await listDocuments(requireAccess(req), params.id, query)
  sendSuccess(res, 'Customer documents retrieved successfully.', result)
})

export const uploadDocumentHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<UploadCustomerDocumentBody, unknown, CustomerIdParams>>(req)
  const document = await uploadDocument(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Customer document uploaded successfully.', document, 201)
})

/** Characters outside this set are replaced in the plain `filename` parameter. */
function asciiFilename(filename: string): string {
  return filename.replace(/[^A-Za-z0-9._-]/g, '_')
}

export const downloadDocumentHandler = asyncHandler(async (req, res) => {
  const { params, query } = getValidated<
    ValidatedRequest<unknown, DocumentContentQuery, CustomerDocumentParams>
  >(req)
  const intent = query.intent === 'view' ? 'view' : 'download'
  const file = await downloadDocument(requireAccess(req), params, getRequestMeta(req), intent)
  res.setHeader('Content-Type', file.mimeType)
  res.setHeader('Content-Length', String(file.bytes.length))
  res.setHeader(
    'Content-Disposition',
    `${intent === 'view' ? 'inline' : 'attachment'}; filename="${asciiFilename(file.filename)}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
  )
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.status(200).end(file.bytes)
})

export const archiveDocumentHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerDocumentParams>>(req)
  const document = await archiveDocument(requireAccess(req), params, getRequestMeta(req))
  sendSuccess(res, 'Customer document archived successfully.', document)
})

// OCR -----------------------------------------------------------------------------------------

export const startOcrHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerDocumentParams>>(req)
  const run = await startOcr(requireAccess(req), params, getRequestMeta(req))
  sendSuccess(res, 'Document OCR processed successfully.', run, 201)
})

export const listOcrRunsHandler = asyncHandler(async (req, res) => {
  const { query, params } =
    getValidated<ValidatedRequest<unknown, ListOcrRunsQuery, CustomerDocumentParams>>(req)
  const result = await listDocumentOcrRuns(requireAccess(req), params, query)
  sendSuccess(res, 'Document OCR runs retrieved successfully.', result)
})

export const reviewOcrHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<ReviewOcrBody, unknown, CustomerOcrRunParams>>(req)
  const run = await reviewOcr(requireAccess(req), params, body, getRequestMeta(req))
  sendSuccess(res, 'Document OCR run reviewed successfully.', run)
})

// Duplicates ----------------------------------------------------------------------------------

export const listDuplicatesHandler = asyncHandler(async (req, res) => {
  const { query, params } =
    getValidated<ValidatedRequest<unknown, ListCustomerDuplicatesQuery, CustomerIdParams>>(req)
  const result = await listCustomerDuplicates(requireAccess(req), params.id, query)
  sendSuccess(res, 'Customer duplicate reviews retrieved successfully.', result)
})

export const reviewDuplicateHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<ReviewDuplicateBody, unknown, CustomerDuplicateParams>>(req)
  const review = await reviewCustomerDuplicate(requireAccess(req), params, body, getRequestMeta(req))
  sendSuccess(res, 'Customer duplicate review updated successfully.', review)
})
