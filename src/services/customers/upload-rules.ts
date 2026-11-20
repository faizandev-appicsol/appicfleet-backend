import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  type AllowedUploadMimeType,
} from '../../constants/customers.js'

export function isAllowedMimeType(value: string): value is AllowedUploadMimeType {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(value)
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

/**
 * True when the leading bytes match the declared type:
 * JPEG FF D8, PNG 89 50 4E 47, PDF "%PDF", WEBP "RIFF" ... "WEBP".
 */
export function matchesMagicBytes(mimeType: string, bytes: Uint8Array): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8])
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])
    case 'application/pdf':
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46])
    case 'image/webp':
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
    default:
      return false
  }
}

export type FilenameResult = { ok: true; filename: string } | { ok: false; reason: string }

const MAX_FILENAME_LENGTH = 200

/**
 * Accepts a client filename and returns only its basename. Names that try to climb out of a
 * directory (`..` segments), carry control characters, or have no usable name are rejected.
 */
export function sanitizeFilename(input: string): FilenameResult {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(input)) {
    return { ok: false, reason: 'Filename contains invalid characters' }
  }
  const segments = input.split(/[\\/]+/)
  if (segments.some((segment) => segment === '..')) {
    return { ok: false, reason: 'Filename must not contain path traversal' }
  }
  const base = (segments.filter((segment) => segment !== '' && segment !== '.').pop() ?? '').trim()
  if (!base) return { ok: false, reason: 'Enter a filename' }
  return { ok: true, filename: base.slice(0, MAX_FILENAME_LENGTH) }
}

export type DecodeResult =
  | { ok: true; bytes: Buffer }
  | { ok: false; reason: 'invalid' | 'empty' | 'too_large' }

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/

/** Strict base64 decode with the size limit checked before any buffer is allocated. */
export function decodeBase64Content(contentBase64: string): DecodeResult {
  if (contentBase64.length === 0) return { ok: false, reason: 'empty' }
  if (contentBase64.length % 4 !== 0 || !BASE64_PATTERN.test(contentBase64)) {
    return { ok: false, reason: 'invalid' }
  }
  const padding = contentBase64.endsWith('==') ? 2 : contentBase64.endsWith('=') ? 1 : 0
  const decodedLength = (contentBase64.length / 4) * 3 - padding
  if (decodedLength > MAX_UPLOAD_BYTES) return { ok: false, reason: 'too_large' }
  const bytes = Buffer.from(contentBase64, 'base64')
  if (bytes.length === 0) return { ok: false, reason: 'empty' }
  return { ok: true, bytes }
}
