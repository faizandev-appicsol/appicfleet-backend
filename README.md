# Appic Fleet API

HTTP API for the Appic Fleet console. Responsibilities are split by layer. MongoDB is accessed only through Mongoose and versioned migrations.

Architecture docs: [`../docs/architecture`](../docs/architecture).

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
npm run db:migrate
npm run db:migrate:status
npm run db:migrate:down
npm run db:seed
```

Copy `.env.example` to `.env` before the first run. Apply migrations with `npm run db:migrate`.

- `GET /api/v1/health` — liveness (process up)
- `GET /api/v1/health/ready` — readiness (MongoDB up + migrations applied)

`MONGODB_URI` accepts a local URL (`mongodb://127.0.0.1:27017/appicfleet`) or an Atlas URL (`mongodb+srv://`). `npm run db:seed` creates the administrator (and the Module 3 tenancy data) only when both `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are set. It does not print the password, and it does not replace an account that already exists.

Set the console to `VITE_API_URL=http://localhost:4000/api/v1` when the API uses port 4000.

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

`POST /api/v1/auth/login` checks the password with bcrypt, returns an access token, and sets an HttpOnly `fleet_refresh` cookie on `/api/v1/auth`. Refresh tokens rotate, are stored only as a SHA-256 hash, and are revoked on logout. Reuse of a revoked refresh token revokes that account's remaining refresh tokens.

`authenticate` verifies the bearer token, reloads the account, and attaches `req.user` and `req.access` (the resolved permissions and tenant scope). `requirePermission` is the default gate on routes and denies unless the permission is held; `requireRole` remains as a coarse fallback.

Stored roles are `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `DISPATCHER`, `VIEWER`, and `USER`. JSON uses the lowercase form the console expects. An invited user has an unusable random password and cannot sign in.

## Module 3: tenancy, RBAC and audit

- **Tenancy.** `organizations` → `legal_entities` → `branches`. Users carry `organizationId`, `legalEntityIds`, `branchIds`, `accessAllBranches` (organization-wide) and `accessAllOrganizations` (platform-wide, super admin only). The server enforces scope on every query; another tenant's record is reported as `404`. `email` stays globally unique (a documented simplification); `organizationId` is required for everyone except platform-wide accounts.
- **Permissions** are dotted keys (`users.view`, `branches.manage`, …) listed in `src/constants/permissions.ts` and served by `GET /api/v1/permissions`. The legacy `users:read` and `users:write` aliases still resolve. Default grants per system role live in `SYSTEM_ROLE_PERMISSIONS` (`src/constants/roles.ts`). Role mapping: `ORG_ADMIN` ≈ `ADMIN`, `BRANCH_MANAGER` ≈ `MANAGER`, `STANDARD_USER` ≈ `USER`. System roles are fixed; custom roles are per organization and add permissions through `users.roleIds`. Nobody can grant a permission they do not hold, and `SUPER_ADMIN` cannot be assigned through the API.
- **Authorization service** (`services/authorization`) builds the `AccessContext` and exposes `hasPermission`, `hasOrganizationAccess`, `hasLegalEntityAccess`, `hasBranchAccess` and the matching `assert*` helpers, plus `assertRecordAccess`.
- **Statuses.** Users are `ACTIVE`, `INACTIVE`, `SUSPENDED` or `INVITED`. Legacy `DISABLED` is read as `INACTIVE`. Only `ACTIVE` accounts sign in. Five consecutive failed sign-ins lock the account for 15 minutes.
- **Audit.** `audit_events` records sign-in, sign-out, failed sign-in, user, role, permission, organization, legal entity and branch changes with request ids. Writes never fail the request, and credential-like metadata keys are stripped.
- **Endpoints** (all under `/api/v1`): `/organizations`, `/legal-entities`, `/branches`, `/roles` (list, get, create, `PUT /:id/permissions`), `/permissions`, and on `/users`: `POST /:id/activate`, `POST /:id/deactivate`, `PUT /:id/branches`, `PUT /:id/roles`. `GET /auth/me` returns the organization, roles, permissions and branches.
- **Migration `002_tenancy_rbac`** creates the indexes and backfills the new user fields. Run `npm run db:migrate`, then `npm run db:seed`: existing accounts have no organization until the seed (or an operator) attaches one.
- **Seed** creates system roles, Organization A (legal entity, and the env admin as its organization admin) and, outside production, branches A1 and A2, Organization B, and three DEV-ONLY accounts that share the password `DevOnly!ChangeMe1` (see the comment in `src/database/seed.ts`). Never use them outside local development.

Field-level protection for future HR and finance data is in `services/field-access` (`redactFields`). A login User is not an HR employee.

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
