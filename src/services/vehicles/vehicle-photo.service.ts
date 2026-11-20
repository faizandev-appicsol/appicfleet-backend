import { PERMISSIONS } from '../../constants/permissions.js'
import {
  updateVehicle,
  type VehicleRecord,
} from '../../repositories/vehicles/vehicle.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { forbiddenError, invalidField, notFound } from '../../utils/httpErrors.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { hasPermission } from '../authorization/authorization.service.js'
import {
  decodeBase64Content,
  matchesMagicBytes,
  sanitizeFilename,
} from '../customers/upload-rules.js'
import { getStorage } from '../storage/index.js'
import { loadAccessibleVehicle } from './vehicle-access.js'
import { toVehicleResource, type VehicleResource } from './vehicle.mapper.js'

export type UploadVehiclePhotoInput = {
  filename: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  contentBase64: string
}

export type VehiclePhotoDownload = {
  bytes: Buffer
  mimeType: string
  filename: string
}

export async function uploadVehiclePhoto(
  ctx: AccessContext,
  vehicleId: string,
  input: UploadVehiclePhotoInput,
  meta: RequestMeta,
): Promise<VehicleResource> {
  if (
    !hasPermission(ctx, PERMISSIONS.VEHICLE_UPDATE) &&
    !hasPermission(ctx, PERMISSIONS.VEHICLE_CREATE)
  ) {
    throw forbiddenError('You do not have permission to do that.')
  }
  const vehicle = await loadAccessibleVehicle(ctx, vehicleId)

  const filenameResult = sanitizeFilename(input.filename)
  if (!filenameResult.ok) throw invalidField('filename', filenameResult.reason)

  const decoded = decodeBase64Content(input.contentBase64)
  if (!decoded.ok) {
    const message =
      decoded.reason === 'too_large'
        ? 'The file is too large (5 MB maximum)'
        : 'Invalid file content'
    throw invalidField('contentBase64', message)
  }
  if (!matchesMagicBytes(input.mimeType, decoded.bytes)) {
    throw invalidField('contentBase64', 'The file content does not match its declared type')
  }

  const storage = getStorage()
  const { storageKey } = await storage.put(decoded.bytes, { mimeType: input.mimeType })

  // Replace any previous photo blob after the new one is safely stored.
  const previousKey = vehicle.photoStorageKey
  const updated = await updateVehicle(vehicle.id, vehicle.organizationId, {
    photoStorageKey: storageKey,
    photoMimeType: input.mimeType,
  })
  if (!updated) throw notFound('Vehicle was not found.')

  if (previousKey && previousKey !== storageKey) {
    await storage.remove(previousKey).catch(() => undefined)
  }

  await recordAuditEvent({
    action: AUDIT_ACTIONS.VEHICLE_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.VEHICLE,
    entityId: vehicle.id,
    actorUserId: ctx.userId,
    organizationId: vehicle.organizationId,
    branchId: vehicle.branchId,
    metadata: { photoUploaded: true, mimeType: input.mimeType },
    meta,
  })

  return toVehicleResource(updated, new Date())
}

export async function downloadVehiclePhoto(
  ctx: AccessContext,
  vehicleId: string,
): Promise<VehiclePhotoDownload> {
  if (!hasPermission(ctx, PERMISSIONS.VEHICLE_VIEW)) {
    throw forbiddenError('You do not have permission to do that.')
  }
  const vehicle = await loadAccessibleVehicle(ctx, vehicleId)
  return readVehiclePhoto(vehicle)
}

async function readVehiclePhoto(vehicle: VehicleRecord): Promise<VehiclePhotoDownload> {
  if (!vehicle.photoStorageKey) {
    throw notFound('Vehicle photo was not found.')
  }

  const storage = getStorage()
  if (!(await storage.exists(vehicle.photoStorageKey))) {
    throw notFound('Vehicle photo was not found.')
  }
  const bytes = await storage.read(vehicle.photoStorageKey)
  const mimeType = vehicle.photoMimeType || 'image/jpeg'
  const extension =
    mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  return {
    bytes,
    mimeType,
    filename: `${vehicle.plateNumber.toLowerCase()}.${extension}`,
  }
}
