import { createHash } from 'node:crypto'
import { HR_DOCUMENT_STATUSES } from '../../constants/hr.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  findDocumentById,
  insertDocument,
  listDocuments,
  listExpiringDocuments,
  updateDocument,
} from '../../repositories/hr/hr.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission } from '../authorization/authorization.service.js'
import {
  decodeBase64Content,
  matchesMagicBytes,
  sanitizeFilename,
} from '../customers/upload-rules.js'
import { getStorage } from '../storage/index.js'
import { loadAccessibleEmployee } from './hr-access.js'
import { resolveDocumentExpiryStatus } from './hr-document-status.js'
import { emitDocumentExpiryIntent } from './hr-notifications.js'
import { toDocumentResource } from './hr.mapper.js'

export async function listEmployeeDocuments(
  ctx: AccessContext,
  employeeId: string,
  query: { page?: number; pageSize?: number; status?: string },
) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_DOCUMENT_VIEW)
  const employee = await loadAccessibleEmployee(ctx, employeeId)
  const pagination = resolvePagination(query)
  const page = await listDocuments({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    status: query.status?.toUpperCase() as never,
    skip: pagination.skip,
    take: pagination.take,
  })
  return toPaginated(page.items.map(toDocumentResource), pagination.page, pagination.limit, page.total)
}

export async function uploadEmployeeDocument(
  ctx: AccessContext,
  employeeId: string,
  body: {
    documentType: string
    documentNumber?: string
    issuedOn?: Date
    expiresOn?: Date
    issuingAuthority?: string
    notes?: string
    filename: string
    mimeType: string
    contentBase64: string
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_DOCUMENT_MANAGE)
  const employee = await loadAccessibleEmployee(ctx, employeeId)
  const filename = sanitizeFilename(body.filename)
  if (!filename.ok) throw invalidField('filename', filename.reason)

  const decoded = decodeBase64Content(body.contentBase64)
  if (!decoded.ok) throw invalidField('contentBase64', 'Invalid file content.')
  if (!matchesMagicBytes(body.mimeType, decoded.bytes)) {
    throw invalidField('mimeType', 'File content does not match the declared type.')
  }

  const sha256 = createHash('sha256').update(decoded.bytes).digest('hex')
  const storage = getStorage()
  const { storageKey } = await storage.put(decoded.bytes, { mimeType: body.mimeType })
  const status = resolveDocumentExpiryStatus(body.expiresOn)

  try {
    const document = await insertDocument({
      organizationId: employee.organizationId,
      employeeId: employee.id,
      documentType: body.documentType.toUpperCase() as never,
      documentNumber: body.documentNumber?.trim(),
      issuedOn: body.issuedOn,
      expiresOn: body.expiresOn,
      issuingAuthority: body.issuingAuthority?.trim(),
      storageKey,
      originalFilename: filename.filename,
      byteSize: decoded.bytes.length,
      mimeType: body.mimeType,
      sha256,
      status,
      notes: body.notes?.trim(),
      uploadedBy: ctx.userId,
    })

    await recordAuditEvent({
      action: AUDIT_ACTIONS.HR_EMPLOYEE_DOCUMENT_ADD,
      entityType: AUDIT_ENTITY_TYPES.HR_DOCUMENT,
      entityId: document.id,
      actorUserId: ctx.userId,
      organizationId: employee.organizationId,
      metadata: {
        employeeId: employee.id,
        documentType: document.documentType,
        hashPrefix: sha256.slice(0, 8),
      },
      meta,
    })

    await emitDocumentExpiryIntent(employee, document, meta)
    return toDocumentResource(document)
  } catch (error) {
    await storage.remove(storageKey).catch(() => undefined)
    throw error
  }
}

export async function archiveEmployeeDocument(
  ctx: AccessContext,
  employeeId: string,
  documentId: string,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_DOCUMENT_MANAGE)
  const employee = await loadAccessibleEmployee(ctx, employeeId)
  const document = await findDocumentById(documentId)
  if (!document || document.employeeId !== employee.id) throw notFound('Document was not found.')
  const updated = await updateDocument(document.id, { status: HR_DOCUMENT_STATUSES.ARCHIVED })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.HR_EMPLOYEE_DOCUMENT_REMOVE,
    entityType: AUDIT_ENTITY_TYPES.HR_DOCUMENT,
    entityId: document.id,
    actorUserId: ctx.userId,
    organizationId: employee.organizationId,
    metadata: { employeeId: employee.id },
    meta,
  })
  return toDocumentResource(updated!)
}

export async function downloadEmployeeDocument(
  ctx: AccessContext,
  employeeId: string,
  documentId: string,
) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_DOCUMENT_VIEW)
  const employee = await loadAccessibleEmployee(ctx, employeeId)
  const document = await findDocumentById(documentId)
  if (!document || document.employeeId !== employee.id) throw notFound('Document was not found.')
  const storage = getStorage()
  if (!(await storage.exists(document.storageKey))) throw notFound('The document file was not found.')
  const bytes = await storage.read(document.storageKey)
  return {
    bytes,
    mimeType: document.mimeType,
    filename: document.originalFilename,
  }
}

export async function listDocumentExpiry(
  ctx: AccessContext,
  query: { organizationId?: string; page?: number; pageSize?: number; days?: number },
) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_DOCUMENT_VIEW)
  const { requireHrOrganization } = await import('./hr-access.js')
  const organizationId = await requireHrOrganization(ctx, query.organizationId)
  const pagination = resolvePagination(query)
  const days = query.days && query.days > 0 ? query.days : 30
  const before = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  const page = await listExpiringDocuments({
    organizationId,
    before,
    skip: pagination.skip,
    take: pagination.take,
  })
  return toPaginated(page.items.map(toDocumentResource), pagination.page, pagination.limit, page.total)
}
