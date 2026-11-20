import {
  CUSTOMER_FILE_STATUSES,
  OCR_REVIEW_STATUSES,
  OCR_RUN_STATUSES,
  OCR_STATUSES,
} from '../../constants/customers.js'
import { logger } from '../../lib/logger/index.js'
import {
  beginDocumentOcr,
  findCustomerDocument,
  setDocumentOcrStatus,
} from '../../repositories/customers/customer-document.repository.js'
import {
  findLatestOcrRunId,
  findOcrRun,
  insertOcrRun,
  listOcrRuns,
  reviewOcrRun,
  type CustomerOcrRunRecord,
} from '../../repositories/customers/customer-ocr-run.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  CustomerDocumentParams,
  CustomerOcrRunParams,
  ListOcrRunsQuery,
  ReviewOcrBody,
} from '../../validations/customer.validation.js'
import { getOcrProvider } from '../ocr/mock-ocr.provider.js'
import { ocrRunStatusFor, ocrStatusFor, type OcrResult } from '../ocr/ocr-provider.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { canReveal, loadAccessibleCustomer } from './customer-access.js'
import { toOcrRunResource, type OcrRunResource } from './customer.mapper.js'
import { refreshCustomerDocumentStatus } from './document-status.js'

const OCR_PROVIDER_ERROR = 'OCR_PROVIDER_ERROR'

/**
 * Starts OCR for a document and waits for the result.
 *
 * This runs synchronously inside the request: there is no queue. A background worker can replace
 * the inline call below (enqueue, return the PROCESSING document, let the worker call
 * `insertOcrRun` and `setDocumentOcrStatus`) without changing the API shape.
 *
 * Every call appends a new run; earlier runs are kept. Only the mock provider exists, and it is
 * given the filename and type hint, never the file bytes.
 */
export async function startOcr(
  ctx: AccessContext,
  params: CustomerDocumentParams,
  meta: RequestMeta,
): Promise<OcrRunResource> {
  const customer = await loadAccessibleCustomer(ctx, params.id)
  const existing = await findCustomerDocument(customer.id, customer.organizationId, params.documentId)
  if (!existing) throw notFound('Document was not found.')
  if (existing.status !== CUSTOMER_FILE_STATUSES.ACTIVE) {
    throw conflict('An archived document cannot be processed.')
  }

  // Compare-and-set into PROCESSING so two requests cannot run OCR on the same document at once.
  const document = await beginDocumentOcr(customer.id, customer.organizationId, existing.id)
  if (!document) throw conflict('OCR is already running for this document.')

  let result: OcrResult | null = null
  try {
    result = await getOcrProvider().classifyAndExtract({
      filename: document.originalFilename,
      mimeType: document.mimeType,
      documentTypeHint: document.documentType,
    })
  } catch (error) {
    logger.error('OCR provider failed', {
      module: 'customers',
      operation: 'ocr',
      name: error instanceof Error ? error.name : 'Error',
    })
  }

  let run: CustomerOcrRunRecord
  try {
    run = await insertOcrRun(
      result
        ? {
            documentId: document.id,
            customerId: customer.id,
            organizationId: customer.organizationId,
            provider: result.provider,
            modelVersion: result.modelVersion,
            detectedType: result.detectedType,
            typeConfidence: result.typeConfidence,
            fields: result.fields,
            status: ocrRunStatusFor(result),
          }
        : {
            documentId: document.id,
            customerId: customer.id,
            organizationId: customer.organizationId,
            provider: 'unknown',
            modelVersion: 'unknown',
            detectedType: document.documentType,
            typeConfidence: 0,
            fields: [],
            status: OCR_RUN_STATUSES.FAILED,
            errorCode: OCR_PROVIDER_ERROR,
          },
    )
  } catch (error) {
    // Never leave the document stuck in PROCESSING.
    await setDocumentOcrStatus(customer.id, customer.organizationId, document.id, OCR_STATUSES.FAILED)
    await refreshCustomerDocumentStatus(customer)
    throw error
  }

  await setDocumentOcrStatus(
    customer.id,
    customer.organizationId,
    document.id,
    result ? ocrStatusFor(result) : OCR_STATUSES.FAILED,
  )
  await refreshCustomerDocumentStatus(customer)

  await recordAuditEvent({
    action: AUDIT_ACTIONS.CUSTOMER_OCR_PROCESSED,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: customer.id,
    actorUserId: ctx.userId,
    organizationId: customer.organizationId,
    branchId: customer.branchId,
    // Extracted values are deliberately not logged.
    metadata: {
      documentId: document.id,
      runId: run.id,
      provider: run.provider,
      detectedType: run.detectedType,
      status: run.status,
      fieldCount: run.fields.length,
    },
    meta,
  })
  return toOcrRunResource(run, false)
}

export async function listDocumentOcrRuns(
  ctx: AccessContext,
  params: CustomerDocumentParams,
  query: ListOcrRunsQuery,
) {
  const customer = await loadAccessibleCustomer(ctx, params.id)
  const document = await findCustomerDocument(customer.id, customer.organizationId, params.documentId)
  if (!document) throw notFound('Document was not found.')

  const pagination = resolvePagination(query)
  const reveal = canReveal(ctx, query.reveal)
  const result = await listOcrRuns({
    documentId: document.id,
    customerId: customer.id,
    organizationId: customer.organizationId,
    skip: pagination.skip,
    take: pagination.take,
  })
  return toPaginated(
    result.items.map((run) => toOcrRunResource(run, reveal)),
    pagination.page,
    pagination.limit,
    result.total,
  )
}

/**
 * Records the human review of the newest run. Approving may carry corrections for fields the run
 * extracted (stored as `reviewedFields`; the raw extraction is never overwritten). The document
 * becomes COMPLETED on approve and FAILED on reject.
 */
export async function reviewOcr(
  ctx: AccessContext,
  params: CustomerOcrRunParams,
  input: ReviewOcrBody,
  meta: RequestMeta,
): Promise<OcrRunResource> {
  const customer = await loadAccessibleCustomer(ctx, params.id)
  const document = await findCustomerDocument(customer.id, customer.organizationId, params.documentId)
  if (!document) throw notFound('Document was not found.')
  const run = await findOcrRun(document.id, customer.id, customer.organizationId, params.runId)
  if (!run) throw notFound('OCR run was not found.')

  if (document.status !== CUSTOMER_FILE_STATUSES.ACTIVE) {
    throw conflict('An archived document cannot be reviewed.')
  }
  if (run.status === OCR_RUN_STATUSES.FAILED) {
    throw conflict('A failed OCR run cannot be reviewed. Start OCR again.')
  }
  if (run.reviewStatus !== OCR_REVIEW_STATUSES.NONE) {
    throw conflict('This OCR run was already reviewed.')
  }
  // Reviewing an old run would overwrite the document status set by a newer one.
  const latestRunId = await findLatestOcrRunId(document.id, customer.organizationId)
  if (latestRunId !== run.id) throw conflict('A newer OCR run exists for this document.')

  const approve = input.decision === 'approve'

  // Corrections: only keys the run extracted; the last value for a key wins.
  const corrections = new Map<string, string>()
  if (approve) {
    const known = new Set(run.fields.map((field) => field.key))
    for (const field of input.fields ?? []) {
      if (!known.has(field.key)) throw invalidField('fields', 'A corrected field was not extracted by this run')
      corrections.set(field.key, field.value)
    }
  }
  const reviewedFields = [...corrections].map(([key, value]) => ({ key, value }))

  const reviewed = await reviewOcrRun({
    runId: run.id,
    documentId: document.id,
    customerId: customer.id,
    organizationId: customer.organizationId,
    reviewStatus: approve ? OCR_REVIEW_STATUSES.APPROVED : OCR_REVIEW_STATUSES.REJECTED,
    reviewedFields,
    reviewedBy: ctx.userId,
  })
  if (!reviewed) throw conflict('This OCR run was already reviewed.')

  await setDocumentOcrStatus(
    customer.id,
    customer.organizationId,
    document.id,
    approve ? OCR_STATUSES.COMPLETED : OCR_STATUSES.FAILED,
  )
  await refreshCustomerDocumentStatus(customer)

  await recordAuditEvent({
    action: AUDIT_ACTIONS.CUSTOMER_OCR_REVIEWED,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: customer.id,
    actorUserId: ctx.userId,
    organizationId: customer.organizationId,
    branchId: customer.branchId,
    // Corrected values are deliberately not logged, only which fields were corrected.
    metadata: {
      documentId: document.id,
      runId: reviewed.id,
      decision: input.decision,
      correctedFieldKeys: reviewedFields.map((field) => field.key),
    },
    meta,
  })
  return toOcrRunResource(reviewed, false)
}
