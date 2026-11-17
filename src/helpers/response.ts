import type { Response } from 'express'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function sendSuccess<T>(res: Response, message: string, data: T, statusCode = 200): void {
  const body: Record<string, unknown> = {
    success: true,
    message,
    data,
  }

  // The fleet console validates session and user payloads on the response root.
  if (isPlainObject(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (key === 'success' || key === 'message' || key === 'data') continue
      body[key] = value
    }
  }

  res.status(statusCode).json(body)
}
