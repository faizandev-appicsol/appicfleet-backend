export const appConfig = {
  name: 'Fleet Management API',
  service: 'fleet-management-api',
  apiPrefix: '/api/v1',
  bodyLimit: '100kb',
  apiRateLimit: {
    windowMs: 15 * 60 * 1000,
    limit: 300,
  },
  authRateLimit: {
    windowMs: 15 * 60 * 1000,
    limit: 30,
  },
} as const
