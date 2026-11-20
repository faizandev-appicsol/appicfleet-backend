# Tenancy

Foundation types for organization and branch isolation live in `types.ts`.

Module 3 implements organizations, legal entities, and branches as first-class collections.
Authorization and record scope are enforced through `AuthorizationService` (`req.access`).

Rules for future modules:

1. Persist `organizationId` on tenant-owned collections (and `branchId` when branch-scoped).
2. Scope every repository query by tenant.
3. Resolve tenant from the authenticated session / membership — never from an untrusted client field alone.
4. Call `assertRecordAccess` (or equivalent) before returning or mutating a tenant record.
5. Prefer 404 over 403 for out-of-scope IDs when that avoids leaking existence across tenants.
6. Keep cross-module writes behind services, not raw model imports from unrelated modules.
7. Login `users` are not HR employees — do not conflate the two domains.
