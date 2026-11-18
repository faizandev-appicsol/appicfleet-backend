export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Fleet Management API',
    version: '0.1.0',
    description:
      'Versioned HTTP API for the fleet console. Routes stay registered from routes/index.ts.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Process and database health',
        responses: { '200': { description: 'API process is running' } },
      },
    },
    '/auth/login': { post: { summary: 'Start a session' } },
    '/auth/logout': { post: { summary: 'Revoke the refresh token and clear its cookie' } },
    '/auth/refresh': { post: { summary: 'Rotate the refresh token and issue an access token' } },
    '/auth/me': {
      get: { summary: 'Current account', security: [{ bearerAuth: [] }] },
    },
    '/users': {
      get: { summary: 'List users', security: [{ bearerAuth: [] }] },
      post: { summary: 'Invite a user', security: [{ bearerAuth: [] }] },
    },
    '/users/{id}': {
      get: { summary: 'Get a user', security: [{ bearerAuth: [] }] },
      patch: { summary: 'Update a user', security: [{ bearerAuth: [] }] },
      delete: { summary: 'Delete a user', security: [{ bearerAuth: [] }] },
    },
  },
} as const
