import type { ZodError } from 'zod'

export function fieldErrorsFromZod(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const field =
      issue.path.length > 0 ? issue.path.map((part) => String(part)).join('.') : 'request'
    const messages = fieldErrors[field] ?? []
    messages.push(issue.message)
    fieldErrors[field] = messages
  }

  return fieldErrors
}
