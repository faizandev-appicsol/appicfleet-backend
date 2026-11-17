import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({ quiet: true })

const durationSchema = z.string().regex(/^\d+[smhd]$/, 'Use a duration such as 15m, 12h, or 7d')

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),
    MONGODB_URI: z
      .string()
      .min(1)
      .refine(
        (value) => value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'),
        'MONGODB_URI must be a MongoDB connection string',
      ),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: durationSchema.default('15m'),
    JWT_REFRESH_EXPIRES_IN: durationSchema.default('7d'),
    CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional(),
    SEED_ADMIN_EMAIL: z.email().optional(),
    SEED_ADMIN_PASSWORD: z
      .string()
      .min(8)
      .regex(/[A-Za-z]/, 'Include a letter')
      .regex(/[0-9]/, 'Include a number')
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
      })
    }
  })

function read(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function loadEnv() {
  const parsed = envSchema.safeParse({
    NODE_ENV: read('NODE_ENV'),
    PORT: read('PORT'),
    MONGODB_URI: read('MONGODB_URI'),
    JWT_ACCESS_SECRET: read('JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: read('JWT_REFRESH_SECRET'),
    JWT_ACCESS_EXPIRES_IN: read('JWT_ACCESS_EXPIRES_IN'),
    JWT_REFRESH_EXPIRES_IN: read('JWT_REFRESH_EXPIRES_IN'),
    CORS_ORIGIN: read('CORS_ORIGIN'),
    LOG_LEVEL: read('LOG_LEVEL'),
    SEED_ADMIN_EMAIL: read('SEED_ADMIN_EMAIL'),
    SEED_ADMIN_PASSWORD: read('SEED_ADMIN_PASSWORD'),
  })

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.') || 'environment')
    process.stderr.write(`Invalid environment configuration: ${fields.join(', ')}\n`)
    process.exit(1)
  }

  const value = parsed.data
  const corsOrigins = value.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)

  return {
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    isProduction: value.NODE_ENV === 'production',
    isTest: value.NODE_ENV === 'test',
    mongoUri: value.MONGODB_URI,
    jwtAccessSecret: value.JWT_ACCESS_SECRET,
    jwtRefreshSecret: value.JWT_REFRESH_SECRET,
    jwtAccessExpiresIn: value.JWT_ACCESS_EXPIRES_IN,
    jwtRefreshExpiresIn: value.JWT_REFRESH_EXPIRES_IN,
    corsOrigins,
    logLevel: value.LOG_LEVEL ?? (value.NODE_ENV === 'production' ? 'info' : 'debug'),
    seedAdminEmail: value.SEED_ADMIN_EMAIL?.toLowerCase(),
    seedAdminPassword: value.SEED_ADMIN_PASSWORD,
  } as const
}

export const env = loadEnv()
export type AppEnv = typeof env
