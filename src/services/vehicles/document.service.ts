import { toPublicEnum } from '../../constants/vehicles.js'
import {
  archiveVehicleDocument,
  findVehicleDocument,
  insertVehicleDocument,
  listVehicleDocuments,
  type VehicleDocumentRecord,
} from '../../repositories/vehicles/vehicle-document.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  CreateVehicleDocumentBody,
  ListVehicleDocumentsQuery,
} from '../../validations/vehicle.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { loadAccessibleVehicle } from './vehicle-access.js'
import { toDateOnly } from './vehicle.mapper.js'

export type VehicleDocumentResource = {
  id: string
  vehicleId: string
  documentType: string
  documentNumber?: string
  issuedOn?: string
  expiresOn?: string
  /** Opaque key only; file bytes and any download URL live outside this API. */
  storageKey: string
  status: string
  uploadedBy: string
  createdAt: string
  updatedAt: string
}

function toResource(document: VehicleDocumentRecord): VehicleDocumentResource {
  return {
    id: document.id,
    vehicleId: document.vehicleId,
    documentType: toPublicEnum(document.documentType),
    documentNumber: document.documentNumber,
    issuedOn: document.issuedOn ? toDateOnly(document.issuedOn) : undefined,
    expiresOn: document.expiresOn ? toDateOnly(document.expiresOn) : undefined,
    storageKey: document.storageKey,
    status: toPublicEnum(document.status),
    uploadedBy: document.uploadedBy,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  }
}

export async function listDocuments(
  ctx: AccessContext,
  vehicleId: string,
  query: ListVehicleDocumentsQuery,
) {
  const vehicle = await loadAccessibleVehicle(ctx, vehicleId)
  const pagination = resolvePagination(query)
  const result = await listVehicleDocuments({
    vehicleId: vehicle.id,
    organizationId: vehicle.organizationId,
    skip: pagination.skip,
    take: pagination.take,
    status: query.status,
    documentType: query.documentType,
  })
  return toPaginated(result.items.map(toResource), pagination.page, pagination.limit, result.total)
}

export async function createDocument(
  ctx: AccessContext,
  vehicleId: string,
  input: CreateVehicleDocumentBody,
  meta: RequestMeta,
): Promise<VehicleDocumentResource> {
  const vehicle = await loadAccessibleVehicle(ctx, vehicleId)
  const document = await insertVehicleDocument({
    vehicleId: vehicle.id,
    organizationId: vehicle.organizationId,
    documentType: input.documentType,
    documentNumber: input.documentNumber,
    issuedOn: input.issuedOn,
    expiresOn: input.expiresOn,
    storageKey: input.storageKey,
    uploadedBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.VEHICLE_DOCUMENT_CREATE,
    entityType: AUDIT_ENTITY_TYPES.VEHICLE,
    entityId: vehicle.id,
    actorUserId: ctx.userId,
    organizationId: vehicle.organizationId,
    branchId: vehicle.branchId,
    // storageKey is deliberately not logged.
    metadata: { documentId: document.id, documentType: document.documentType },
    meta,
  })
  return toResource(document)
}

export async function archiveDocument(
  ctx: AccessContext,
  vehicleId: string,
  documentId: string,
  meta: RequestMeta,
): Promise<VehicleDocumentResource> {
  const vehicle = await loadAccessibleVehicle(ctx, vehicleId)
  const existing = await findVehicleDocument(vehicle.id, vehicle.organizationId, documentId)
  if (!existing) throw notFound('Document was not found.')

  const archived = await archiveVehicleDocument(vehicle.id, vehicle.organizationId, existing.id)
  if (!archived) throw conflict('Document is already archived.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.VEHICLE_DOCUMENT_ARCHIVE,
    entityType: AUDIT_ENTITY_TYPES.VEHICLE,
    entityId: vehicle.id,
    actorUserId: ctx.userId,
    organizationId: vehicle.organizationId,
    branchId: vehicle.branchId,
    metadata: { documentId: archived.id, documentType: archived.documentType },
    meta,
  })
  return toResource(archived)
}
