import { createHash } from 'node:crypto'
import { CUSTOMER_FILE_STATUSES } from '../../constants/customers.js'
import {
  archiveCustomerDocument,
  existsHashForOtherCustomer,
  findCustomerDocument,
  findCustomerDocumentByHash,
  insertCustomerDocument,
  listCustomerDocuments,
  type CustomerDocumentRecord,
} from '../../repositories/customers/customer-document.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  CustomerDocumentParams,
  ListCustomerDocumentsQuery,
  UploadCustomerDocumentBody,
} from '../../validations/customer.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { getStorage } from '../storage/index.js'
import { loadAccessibleCustomer } from './customer-access.js'
import { toDocumentResource, type CustomerDocumentResource } from './customer.mapper.js'
import { refreshCustomerDocumentStatus } from './document-status.js'
import { decodeBase64Content, matchesMagicBytes, sanitizeFilename } from './upload-rules.js'

/** Only a short prefix of the hash is ever written to the audit trail. */
const HASH_PREFIX_LENGTH = 8

export async function listDocuments(
  ctx: AccessContext,
  customerId: string,
  query: ListCustomerDocumentsQuery,
) {
  const customer = await loadAccessibleCustomer(ctx, customerId)
  const pagination = resolvePagination(query)
  const result = await listCustomerDocuments({
    customerId: customer.id,
    organizationId: customer.organizationId,
    skip: pagination.skip,
    take: pagination.take,
    status: query.status,
    documentType: query.documentType,
  })
  return toPaginated(
    result.items.map(toDocumentResource),
    pagination.page,
    pagination.limit,
    result.total,
  )
}

/**
 * Stores an uploaded file. Checks, in order: filename (basename only, no traversal), strict
 * base64, decoded size, magic bytes against the declared type, then the hash. The same file for
 * the same customer is a 409 and nothing is written; the same file for another customer is
 * stored and flagged.
 */
export async function uploadDocument(
  ctx: AccessContext,
  customerId: string,
  input: UploadCustomerDocumentBody,
  meta: RequestMeta,
): Promise<CustomerDocumentResource> {
  const customer = await loadAccessibleCustomer(ctx, customerId)

  const filename = sanitizeFilename(input.filename)
  if (!filename.ok) throw invalidField('filename', filename.reason)

  const decoded = decodeBase64Content(input.contentBase64)
  if (!decoded.ok) {
    const message =
      decoded.reason === 'too_large'
        ? 'The file is too large (5 MB maximum)'
        : decoded.reason === 'empty'
          ? 'The file is empty'
          : 'The file content is not valid base64'
    throw invalidField('contentBase64', message)
  }
  const bytes = decoded.bytes
  if (!matchesMagicBytes(input.mimeType, bytes)) {
    throw invalidField('contentBase64', 'The file content does not match its declared type')
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const sha256Prefix = sha256.slice(0, HASH_PREFIX_LENGTH)

  const existing = await findCustomerDocumentByHash(customer.id, customer.organizationId, sha256)
  if (existing) {
    const active = existing.status === CUSTOMER_FILE_STATUSES.ACTIVE
    await recordAuditEvent({
      action: AUDIT_ACTIONS.CUSTOMER_DOCUMENT_UPLOAD,
      entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
      entityId: customer.id,
      actorUserId: ctx.userId,
      organizationId: customer.organizationId,
      branchId: customer.branchId,
      result: 'failure',
      metadata: {
        documentType: input.documentType,
        outcome: active ? 'duplicate_for_customer' : 'duplicate_archived_for_customer',
        existingDocumentId: existing.id,
        sha256Prefix,
      },
      meta,
    })
    throw conflict(
      active
        ? 'This file has already been uploaded for this customer.'
        : 'This file was uploaded for this customer before and is archived.',
    )
  }

  const sharedWithOtherCustomer = await existsHashForOtherCustomer(
    customer.id,
    customer.organizationId,
    sha256,
  )

  const storage = getStorage()
  const { storageKey } = await storage.put(bytes, { mimeType: input.mimeType })
  let document: CustomerDocumentRecord
  try {
    document = await insertCustomerDocument({
      customerId: customer.id,
      organizationId: customer.organizationId,
      branchId: customer.branchId,
      documentType: input.documentType,
      storageKey,
      originalFilename: filename.filename,
      byteSize: bytes.length,
      mimeType: input.mimeType,
      sha256,
      duplicateFileFlag: sharedWithOtherCustomer,
      issuedOn: input.issuedOn,
      expiresOn: input.expiresOn,
      uploadedBy: ctx.userId,
    })
  } catch (error) {
    // Do not leave an orphan blob behind when the metadata could not be saved.
    await storage.remove(storageKey).catch(() => undefined)
    throw error
  }

  await refreshCustomerDocumentStatus(customer)

  await recordAuditEvent({
    action: AUDIT_ACTIONS.CUSTOMER_DOCUMENT_UPLOAD,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: customer.id,
    actorUserId: ctx.userId,
    organizationId: customer.organizationId,
    branchId: customer.branchId,
    // Filename, storage key and file bytes are deliberately not logged.
    metadata: {
      documentId: document.id,
      documentType: document.documentType,
      byteSize: document.byteSize,
      mimeType: document.mimeType,
      sha256Prefix,
      duplicateFileFlag: document.duplicateFileFlag,
    },
    meta,
  })
  return toDocumentResource(document)
}

export type DocumentDownload = {
  bytes: Buffer
  mimeType: string
  filename: string
}

/** Returns the file for a caller with customer.view_sensitive (enforced on the route) and audits it. */
export async function downloadDocument(
  ctx: AccessContext,
  params: CustomerDocumentParams,
  meta: RequestMeta,
  intent: 'view' | 'download' = 'download',
): Promise<DocumentDownload> {
  const customer = await loadAccessibleCustomer(ctx, params.id)
  const document = await findCustomerDocument(customer.id, customer.organizationId, params.documentId)
  if (!document) throw notFound('Document was not found.')

  const storage = getStorage()
  if (!(await storage.exists(document.storageKey))) throw notFound('The document file was not found.')
  const bytes = await storage.read(document.storageKey)

  await recordAuditEvent({
    action:
      intent === 'view'
        ? AUDIT_ACTIONS.CUSTOMER_DOCUMENT_VIEW
        : AUDIT_ACTIONS.CUSTOMER_DOCUMENT_DOWNLOAD,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: customer.id,
    actorUserId: ctx.userId,
    organizationId: customer.organizationId,
    branchId: customer.branchId,
    metadata: { documentId: document.id, documentType: document.documentType },
    meta,
  })
  return { bytes, mimeType: document.mimeType, filename: document.originalFilename }
}

export async function archiveDocument(
  ctx: AccessContext,
  params: CustomerDocumentParams,
  meta: RequestMeta,
): Promise<CustomerDocumentResource> {
  const customer = await loadAccessibleCustomer(ctx, params.id)
  const existing = await findCustomerDocument(customer.id, customer.organizationId, params.documentId)
  if (!existing) throw notFound('Document was not found.')

  const archived = await archiveCustomerDocument(customer.id, customer.organizationId, existing.id)
  if (!archived) throw conflict('Document is already archived.')

  await refreshCustomerDocumentStatus(customer)

  await recordAuditEvent({
    action: AUDIT_ACTIONS.CUSTOMER_DOCUMENT_ARCHIVE,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: customer.id,
    actorUserId: ctx.userId,
    organizationId: customer.organizationId,
    branchId: customer.branchId,
    metadata: { documentId: archived.id, documentType: archived.documentType },
    meta,
  })
  return toDocumentResource(archived)
}
