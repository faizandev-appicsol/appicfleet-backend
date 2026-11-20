import { env } from '../../config/env.js'
import { LocalStorageService } from './local-storage.service.js'
import { S3StorageService } from './s3-storage.service.js'
import type { StorageService } from './storage.types.js'

export type { StoragePutOptions, StoragePutResult, StorageService } from './storage.types.js'
export { LocalStorageService, resolveStorageDir } from './local-storage.service.js'
export { S3StorageService } from './s3-storage.service.js'

let storage: StorageService | undefined

/**
 * Shared storage for all uploaded images/documents in the system.
 * Uses S3 when STORAGE_DRIVER=s3, otherwise local disk.
 */
export function getStorage(): StorageService {
  if (storage) return storage

  if (env.storageDriver === 's3') {
    storage = new S3StorageService()
  } else {
    storage = new LocalStorageService()
  }
  return storage
}
