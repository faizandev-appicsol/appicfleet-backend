import { CUSTOMER_DOCUMENT_TYPES, type CustomerDocumentType } from '../../constants/customers.js'
import type { OcrExtractedField, OcrInput, OcrProvider, OcrResult } from './ocr-provider.js'

export const MOCK_OCR_PROVIDER = 'mock'
export const MOCK_OCR_MODEL_VERSION = 'mock-1'

const TYPE_CONFIDENCE_MATCHED = 0.93
const TYPE_CONFIDENCE_UNKNOWN = 0.4

/** Order matters: "trade license" must win over the plain "license" rule. */
const TYPE_RULES: ReadonlyArray<{ type: CustomerDocumentType; pattern: RegExp }> = [
  { type: CUSTOMER_DOCUMENT_TYPES.TRADE_LICENSE, pattern: /trade/ },
  // Whole word, so names such as "private" do not match.
  { type: CUSTOMER_DOCUMENT_TYPES.VAT_CERTIFICATE, pattern: /(^|[^a-z])vat([^a-z]|$)/ },
  { type: CUSTOMER_DOCUMENT_TYPES.PASSPORT, pattern: /passport/ },
  { type: CUSTOMER_DOCUMENT_TYPES.EMIRATES_ID, pattern: /emirates/ },
  { type: CUSTOMER_DOCUMENT_TYPES.DRIVING_LICENSE, pattern: /license|licence/ },
]

function classify(text: string): CustomerDocumentType | null {
  const lowered = text.toLowerCase()
  for (const rule of TYPE_RULES) {
    if (rule.pattern.test(lowered)) return rule.type
  }
  return null
}

/** Synthetic values only. They are clearly marked MOCK and never come from the file. */
function mockFields(type: CustomerDocumentType): OcrExtractedField[] {
  switch (type) {
    case CUSTOMER_DOCUMENT_TYPES.TRADE_LICENSE:
      return [
        { key: 'businessName', value: 'MOCK TRADING LLC', confidence: 0.96 },
        { key: 'licenseNumber', value: 'MOCK-LIC-0000', confidence: 0.62 },
      ]
    case CUSTOMER_DOCUMENT_TYPES.VAT_CERTIFICATE:
      return [
        { key: 'businessName', value: 'MOCK TRADING LLC', confidence: 0.96 },
        { key: 'taxNumber', value: 'MOCK-TAX-0000', confidence: 0.62 },
      ]
    case CUSTOMER_DOCUMENT_TYPES.PASSPORT:
      return [
        { key: 'fullName', value: 'MOCK SAMPLE PERSON', confidence: 0.96 },
        { key: 'documentNumber', value: 'MOCK-PASS-0000', confidence: 0.62 },
        { key: 'expiryDate', value: '2099-01-01', confidence: 0.9 },
      ]
    case CUSTOMER_DOCUMENT_TYPES.EMIRATES_ID:
      return [
        { key: 'fullName', value: 'MOCK SAMPLE PERSON', confidence: 0.96 },
        { key: 'documentNumber', value: 'MOCK-EID-0000', confidence: 0.62 },
        { key: 'expiryDate', value: '2099-01-01', confidence: 0.9 },
      ]
    case CUSTOMER_DOCUMENT_TYPES.DRIVING_LICENSE:
      return [
        { key: 'fullName', value: 'MOCK SAMPLE PERSON', confidence: 0.96 },
        { key: 'documentNumber', value: 'MOCK-DL-0000', confidence: 0.62 },
        { key: 'expiryDate', value: '2099-01-01', confidence: 0.9 },
      ]
    default:
      return []
  }
}

/**
 * Test and development provider. It is NOT an OCR engine: it never receives file bytes, never
 * looks at pixels (so it cannot read faces) and never calls the network. It only guesses a type
 * from the filename or the caller's hint and returns synthetic fields.
 */
export class MockOcrProvider implements OcrProvider {
  async classifyAndExtract(input: OcrInput): Promise<OcrResult> {
    const detected = classify(input.documentTypeHint) ?? classify(input.filename)
    if (!detected) {
      return {
        provider: MOCK_OCR_PROVIDER,
        modelVersion: MOCK_OCR_MODEL_VERSION,
        detectedType: CUSTOMER_DOCUMENT_TYPES.OTHER,
        typeConfidence: TYPE_CONFIDENCE_UNKNOWN,
        fields: [],
      }
    }
    return {
      provider: MOCK_OCR_PROVIDER,
      modelVersion: MOCK_OCR_MODEL_VERSION,
      detectedType: detected,
      typeConfidence: TYPE_CONFIDENCE_MATCHED,
      fields: mockFields(detected),
    }
  }
}

let provider: OcrProvider | undefined

/** The only provider this module ships. A real engine would be swapped in here. */
export function getOcrProvider(): OcrProvider {
  provider ??= new MockOcrProvider()
  return provider
}
