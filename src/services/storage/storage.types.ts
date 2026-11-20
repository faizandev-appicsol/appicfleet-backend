export type StoragePutOptions = {
  mimeType: string
}

export type StoragePutResult = {
  /** Opaque random key. Not a URL, and never derived from the original filename. */
  storageKey: string
}

/**
 * Private blob storage. There is no public URL: bytes only leave through `read`, behind an
 * authorized API call.
 */
export interface StorageService {
  put(bytes: Buffer, options: StoragePutOptions): Promise<StoragePutResult>
  read(storageKey: string): Promise<Buffer>
  exists(storageKey: string): Promise<boolean>
  /** Best-effort cleanup, used only when a write has to be rolled back. */
  remove(storageKey: string): Promise<void>
}
