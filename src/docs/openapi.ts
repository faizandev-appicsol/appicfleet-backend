export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Appic Fleet API',
    version: '0.1.0',
    description:
      'Versioned HTTP API for the Appic Fleet console. Routes stay registered from routes/index.ts.',
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
        summary: 'Liveness probe',
        responses: { '200': { description: 'API process is running' } },
      },
    },
    '/health/ready': {
      get: {
        summary: 'Readiness probe',
        responses: {
          '200': { description: 'Database is up and migrations are applied' },
          '503': { description: 'Database down or migrations pending' },
        },
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
    '/vendors': {
      get: { summary: 'List vendors', security: [{ bearerAuth: [] }] },
      post: { summary: 'Create vendor', security: [{ bearerAuth: [] }] },
    },
    '/vendors/{id}': {
      get: { summary: 'Get vendor', security: [{ bearerAuth: [] }] },
      patch: { summary: 'Update vendor', security: [{ bearerAuth: [] }] },
    },
    '/vendors/{id}/disable': {
      post: { summary: 'Disable vendor', security: [{ bearerAuth: [] }] },
    },
    '/lpos': {
      get: { summary: 'List LPOs', security: [{ bearerAuth: [] }] },
      post: { summary: 'Create LPO draft', security: [{ bearerAuth: [] }] },
    },
    '/lpos/{id}': {
      get: { summary: 'Get LPO', security: [{ bearerAuth: [] }] },
      patch: { summary: 'Update LPO draft', security: [{ bearerAuth: [] }] },
    },
    '/lpos/{id}/submit': { post: { summary: 'Submit LPO', security: [{ bearerAuth: [] }] } },
    '/lpos/{id}/approve': { post: { summary: 'Approve LPO', security: [{ bearerAuth: [] }] } },
    '/lpos/{id}/cancel': { post: { summary: 'Cancel LPO', security: [{ bearerAuth: [] }] } },
    '/vendor-bills': {
      get: { summary: 'List vendor bills', security: [{ bearerAuth: [] }] },
      post: { summary: 'Create vendor bill draft', security: [{ bearerAuth: [] }] },
    },
    '/vendor-bills/{id}': { get: { summary: 'Get vendor bill', security: [{ bearerAuth: [] }] } },
    '/vendor-bills/{id}/submit': { post: { summary: 'Submit vendor bill', security: [{ bearerAuth: [] }] } },
    '/vendor-bills/{id}/approve': { post: { summary: 'Approve vendor bill', security: [{ bearerAuth: [] }] } },
    '/vendor-bills/{id}/post': { post: { summary: 'Post vendor bill', security: [{ bearerAuth: [] }] } },
    '/expenses': {
      get: { summary: 'List expenses', security: [{ bearerAuth: [] }] },
      post: { summary: 'Create expense draft', security: [{ bearerAuth: [] }] },
    },
    '/expenses/categories': { get: { summary: 'List expense categories', security: [{ bearerAuth: [] }] } },
    '/expenses/{id}': {
      get: { summary: 'Get expense', security: [{ bearerAuth: [] }] },
      patch: { summary: 'Update expense draft', security: [{ bearerAuth: [] }] },
    },
    '/expenses/{id}/submit': { post: { summary: 'Submit expense', security: [{ bearerAuth: [] }] } },
    '/expenses/{id}/approve': { post: { summary: 'Approve expense', security: [{ bearerAuth: [] }] } },
    '/expenses/{id}/post': { post: { summary: 'Post expense', security: [{ bearerAuth: [] }] } },
    '/work-orders': {
      get: { summary: 'List work orders', security: [{ bearerAuth: [] }] },
      post: { summary: 'Create work order', security: [{ bearerAuth: [] }] },
    },
    '/work-orders/{id}': {
      get: { summary: 'Get work order', security: [{ bearerAuth: [] }] },
      patch: { summary: 'Update work order draft', security: [{ bearerAuth: [] }] },
    },
    '/work-orders/{id}/schedule': { post: { summary: 'Schedule work order downtime', security: [{ bearerAuth: [] }] } },
    '/work-orders/{id}/complete': { post: { summary: 'Complete work order', security: [{ bearerAuth: [] }] } },
    '/service-reminders': {
      get: { summary: 'List service reminders', security: [{ bearerAuth: [] }] },
      post: { summary: 'Create service reminder', security: [{ bearerAuth: [] }] },
    },
    '/ap-payments': { post: { summary: 'Create AP payment', security: [{ bearerAuth: [] }] } },
    '/ap-payments/{id}/allocate': { post: { summary: 'Allocate AP payment', security: [{ bearerAuth: [] }] } },
    '/borrow-costs/terms': { post: { summary: 'Create borrow cost term', security: [{ bearerAuth: [] }] } },
    '/borrow-costs/allocate': { post: { summary: 'Allocate borrow cost', security: [{ bearerAuth: [] }] } },
  },
} as const
