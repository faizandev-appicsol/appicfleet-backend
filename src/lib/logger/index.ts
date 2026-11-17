import pino from 'pino'
import { env } from '../../config/env.js'

const writer = pino({
  level: env.logLevel,
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'authorization',
      'cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.secret',
      '*.authorization',
      '*.cookie',
    ],
    censor: '[redacted]',
  },
})

function write(
  level: 'error' | 'warn' | 'info' | 'debug',
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (meta) {
    writer[level](meta, message)
    return
  }
  writer[level](message)
}

export const logger = {
  error(message: string, meta?: Record<string, unknown>): void {
    write('error', message, meta)
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    write('warn', message, meta)
  },
  info(message: string, meta?: Record<string, unknown>): void {
    write('info', message, meta)
  },
  debug(message: string, meta?: Record<string, unknown>): void {
    write('debug', message, meta)
  },
}
