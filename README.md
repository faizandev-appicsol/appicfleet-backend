# Fleet Management API

HTTP API for the fleet console. Responsibilities are split by layer. MongoDB is accessed only through Mongoose.

## Stack

- Node.js 20.19+ and Express 5
- TypeScript strict mode
- MongoDB and Mongoose
- Zod, bcrypt, JWT, Helmet, CORS, and rate limiting
- Pino for logs
- Vitest, ESLint, and Prettier

## Scripts

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm start
npm run db:seed
```

Copy `.env.example` to `.env` before the first run. The API listens on `http://localhost:3000`. It still starts when MongoDB is down. `GET /api/v1/health` then returns HTTP 200 with `"database": "down"`.

`MONGODB_URI` accepts a local URL (`mongodb://127.0.0.1:27017/fleet_management`) or an Atlas URL (`mongodb+srv://`). `npm run db:seed` creates an active administrator only when both `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are set. It does not print the password, and it does not replace an account that already exists.

Set the console to `VITE_API_URL=http://localhost:3000/api/v1`.

## Request flow

```text
Client
  -> routes
  -> middlewares
  -> controllers
  -> services
  -> repositories
  -> Mongoose models
  -> MongoDB
```

Routes declare the method, path, middleware, and controller. Controllers read validated input and send the response. Services apply business rules. Repositories run the queries.

## Response shape

Success:

```json
{ "success": true, "message": "Operation successful", "data": {} }
```

Error:

```json
{ "success": false, "message": "Something went wrong", "error": { "code": "ERROR_CODE" } }
```

Validation errors also include `errors`, a map of field names to message arrays. The same success payload is copied onto the response root so the current console can keep reading `accessToken`, `user`, and `items` without unwrapping `data`.

## Authentication

`POST /api/v1/auth/register` creates an active viewer. `POST /api/v1/auth/login` checks the password with bcrypt. Both return an access token and set an HttpOnly `fleet_refresh` cookie on `/api/v1/auth`. Refresh tokens rotate, are stored only as a SHA-256 hash, and are revoked on logout. Reuse of a revoked refresh token revokes that account's remaining refresh tokens.

`authenticate` verifies the bearer token and reloads the account. `requireRole` and `requirePermission` authorize the request. User routes use `users:read` and `users:write`, which belong to `ADMIN` and `MANAGER`.

Stored roles are `ADMIN`, `MANAGER`, `DISPATCHER`, `VIEWER`, and `USER`. JSON uses the lowercase form the console expects. An invited user has an unusable random password and cannot sign in.

## Database

Users live in `users`. Refresh tokens live in `refresh_tokens` and point at a user with an ObjectId. Tokens are a separate collection because they are written on every login and refresh. Deleting a user also deletes that user's refresh tokens in the user service. Indexes are declared on the schemas and synced after a successful connection.

## Add a resource

1. Add `models/<name>.model.ts` and, when the document shape is shared, `interfaces/<name>.interface.ts`.
2. Add queries in `repositories/<name>/`.
3. Add business rules in `services/<name>/`.
4. Add Zod schemas in `validations/<name>.validation.ts`.
5. Add a thin controller in `controllers/<name>/`.
6. Add `routes/<name>.routes.ts` and mount it once in `routes/index.ts`.

Keep database queries in repositories and keep Express objects out of services.
