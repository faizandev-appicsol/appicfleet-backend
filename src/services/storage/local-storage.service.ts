import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { StoragePutOptions, StoragePutResult, StorageService } from './storage.types.js'

const STORAGE_KEY_PATTERN = /^[a-f0-9]{64}$/

/**
 * `STORAGE_DIR` when set, otherwise `backend/var/customer-documents` resolved from the working
 * directory (the working directory is `backend` when the API runs from its own folder).
 */
export function resolveStorageDir(): string {
  const configured = process.env.STORAGE_DIR?.trim()
  if (configured) return path.resolve(configured)
  const cwd = process.cwd()
  const backendDir = path.basename(cwd) === 'backend' ? cwd : path.join(cwd, 'backend')
  return path.join(backendDir, 'var', 'customer-documents')
}

/** Files on local disk named by random hex. Bytes are never logged. */
export class LocalStorageService implements StorageService {
  constructor(private readonly directory: string = resolveStorageDir()) {}

  private pathFor(storageKey: string): string {
    // Anything that is not our own random hex key could be a traversal attempt.
    if (!STORAGE_KEY_PATTERN.test(storageKey)) throw new Error('Invalid storage key')
    return path.join(this.directory, storageKey)
  }

  async put(bytes: Buffer, _options: StoragePutOptions): Promise<StoragePutResult> {
    await mkdir(this.directory, { recursive: true })
    const storageKey = randomBytes(32).toString('hex')
    // `wx` never overwrites an existing file.
    await writeFile(this.pathFor(storageKey), bytes, { flag: 'wx', mode: 0o600 })
    return { storageKey }
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(this.pathFor(storageKey))
  }

  async exists(storageKey: string): Promise<boolean> {
    if (!STORAGE_KEY_PATTERN.test(storageKey)) return false
    try {
      return (await stat(this.pathFor(storageKey))).isFile()
    } catch {
      return false
    }
  }

  async remove(storageKey: string): Promise<void> {
    if (!STORAGE_KEY_PATTERN.test(storageKey)) return
    await rm(this.pathFor(storageKey), { force: true })
  }
}
