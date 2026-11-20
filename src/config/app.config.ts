export const appConfig = {
  name: 'Appic Fleet API',
  service: 'appic-fleet-api',
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
