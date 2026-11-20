/**
 * Field-level access.
 *
 * Some fields are more sensitive than the record that holds them. Future HR and finance modules
 * (salary, bank account, tax and identity documents, performance notes) must pass records through
 * `redactFields` before serializing, using a dedicated permission (for example `hr.salary.view`)
 * to decide `allowed`. Login Users are not HR employees: employee data lives in its own module and
 * is never reachable through the user directory.
 *
 * Redaction is by replacement, not omission, so clients can tell a field exists but is hidden.
 */
export const REDACTED_VALUE = '[REDACTED]'

/**
 * Returns a shallow copy of `record` where each listed field is replaced with '[REDACTED]'
 * unless `allowed` is true. Fields that are absent on the record are not added.
 * The input record is never mutated.
 */
export function redactFields<T extends Record<string, unknown>>(
  record: T,
  fields: readonly (keyof T & string)[],
  allowed: boolean,
): T {
  if (allowed) return { ...record }

  const copy: Record<string, unknown> = { ...record }
  for (const field of fields) {
    if (field in copy && copy[field] !== undefined) copy[field] = REDACTED_VALUE
  }
  return copy as T
}
