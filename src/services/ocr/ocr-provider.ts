import {
  OCR_REVIEW_THRESHOLD,
  OCR_RUN_STATUSES,
  OCR_STATUSES,
  type CustomerDocumentType,
  type OcrRunStatus,
  type OcrStatus,
} from '../../constants/customers.js'

export { OCR_REVIEW_THRESHOLD }

export type OcrExtractedField = {
  key: string
  value: string
  /** 0 to 1. */
  confidence: number
}

/**
 * Deliberately has no file bytes: a provider classifies from the filename and the caller's type
 * hint only. File content is never sent to a provider from this module.
 */
export type OcrInput = {
  filename: string
  mimeType: string
  documentTypeHint: CustomerDocumentType
}

export type OcrResult = {
  provider: string
  modelVersion: string
  detectedType: CustomerDocumentType
  typeConfidence: number
  fields: OcrExtractedField[]
}

export interface OcrProvider {
  classifyAndExtract(input: OcrInput): Promise<OcrResult>
}

/** True when the type or any extracted field is below the review threshold. */
export function needsOcrReview(
  result: Pick<OcrResult, 'typeConfidence' | 'fields'>,
  threshold: number = OCR_REVIEW_THRESHOLD,
): boolean {
  return (
    result.typeConfidence < threshold || result.fields.some((field) => field.confidence < threshold)
  )
}

export function ocrRunStatusFor(result: Pick<OcrResult, 'typeConfidence' | 'fields'>): OcrRunStatus {
  return needsOcrReview(result) ? OCR_RUN_STATUSES.NEEDS_REVIEW : OCR_RUN_STATUSES.COMPLETED
}

/** Document-level OCR status for a finished run. */
export function ocrStatusFor(result: Pick<OcrResult, 'typeConfidence' | 'fields'>): OcrStatus {
  return needsOcrReview(result) ? OCR_STATUSES.NEEDS_REVIEW : OCR_STATUSES.COMPLETED
}
