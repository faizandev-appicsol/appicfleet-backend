import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({ quiet: true })

const durationSchema = z.string().regex(/^\d+[smhd]$/, 'Use a duration such as 15m, 12h, or 7d')

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    APP_NAME: z.string().min(1).default('Appic Fleet API'),
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
    /** local = disk under STORAGE_DIR; s3 = AWS_S3_BUCKET */
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_DIR: z.string().min(1).optional(),
    AWS_REGION: z.string().min(1).optional(),
    AWS_S3_BUCKET: z.string().min(1).optional(),
    AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
    AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    /** Optional key prefix inside the bucket, e.g. fleet-uploads */
    AWS_S3_PREFIX: z.string().default('fleet-uploads'),
  })
  .superRefine((value, context) => {
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
      })
    }
    if (value.STORAGE_DRIVER === 's3') {
      for (const key of ['AWS_REGION', 'AWS_S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] as const) {
        if (!value[key]) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=s3`,
          })
        }
      }
    }
  })

function read(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function loadEnv() {
  const parsed = envSchema.safeParse({
    NODE_ENV: read('NODE_ENV'),
    APP_NAME: read('APP_NAME'),
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
    STORAGE_DRIVER: read('STORAGE_DRIVER'),
    STORAGE_DIR: read('STORAGE_DIR'),
    AWS_REGION: read('AWS_REGION'),
    AWS_S3_BUCKET: read('AWS_S3_BUCKET'),
    AWS_ACCESS_KEY_ID: read('AWS_ACCESS_KEY_ID'),
    AWS_SECRET_ACCESS_KEY: read('AWS_SECRET_ACCESS_KEY'),
    AWS_S3_PREFIX: read('AWS_S3_PREFIX'),
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
    appName: value.APP_NAME,
    port: value.PORT,
    isProduction: value.NODE_ENV === 'production',
    isStaging: value.NODE_ENV === 'staging',
    isTest: value.NODE_ENV === 'test',
    isDevelopment: value.NODE_ENV === 'development',
    mongoUri: value.MONGODB_URI,
    jwtAccessSecret: value.JWT_ACCESS_SECRET,
    jwtRefreshSecret: value.JWT_REFRESH_SECRET,
    jwtAccessExpiresIn: value.JWT_ACCESS_EXPIRES_IN,
    jwtRefreshExpiresIn: value.JWT_REFRESH_EXPIRES_IN,
    corsOrigins,
    logLevel:
      value.LOG_LEVEL ??
      (value.NODE_ENV === 'production' || value.NODE_ENV === 'staging' ? 'info' : 'debug'),
    seedAdminEmail: value.SEED_ADMIN_EMAIL?.toLowerCase(),
    seedAdminPassword: value.SEED_ADMIN_PASSWORD,
    storageDriver: value.STORAGE_DRIVER,
    storageDir: value.STORAGE_DIR,
    awsRegion: value.AWS_REGION,
    awsS3Bucket: value.AWS_S3_BUCKET,
    awsAccessKeyId: value.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: value.AWS_SECRET_ACCESS_KEY,
    awsS3Prefix: value.AWS_S3_PREFIX,
  } as const
}

export const env = loadEnv()
export type AppEnv = typeof env
