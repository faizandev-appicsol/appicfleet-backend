import {
  HR_DOCUMENT_EXPIRY_WARNING_DAYS,
  HR_DOCUMENT_STATUSES,
  type HrDocumentStatus,
} from '../../constants/hr.js'

export function resolveDocumentExpiryStatus(
  expiresOn: Date | undefined | null,
  now = new Date(),
  warningDays = HR_DOCUMENT_EXPIRY_WARNING_DAYS,
): HrDocumentStatus {
  if (!expiresOn) return HR_DOCUMENT_STATUSES.VALID
  const ms = expiresOn.getTime() - now.getTime()
  if (ms < 0) return HR_DOCUMENT_STATUSES.EXPIRED
  const days = ms / (24 * 60 * 60 * 1000)
  if (days <= warningDays) return HR_DOCUMENT_STATUSES.EXPIRING_SOON
  return HR_DOCUMENT_STATUSES.VALID
}
