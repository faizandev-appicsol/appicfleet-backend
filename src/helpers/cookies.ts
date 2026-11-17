import type { CookieOptions, Response } from 'express'
import { env } from '../config/env.js'

export const REFRESH_COOKIE_NAME = 'fleet_refresh'

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/api/v1/auth',
  }
}

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...cookieOptions(),
    expires: expiresAt,
  })
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions())
}

export function readRefreshCookie(cookies: unknown): string | undefined {
  if (typeof cookies !== 'object' || cookies === null || !(REFRESH_COOKIE_NAME in cookies)) {
    return undefined
  }
  const value = (cookies as Record<string, unknown>)[REFRESH_COOKIE_NAME]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
