# Backend modules

This API is a **modular monolith**. Existing auth and users code currently lives under
`routes/`, `controllers/`, `services/`, and `repositories/` for compatibility.

New business domains should be added as focused modules under this folder:

```text
modules/<domain>/
  <domain>.routes.ts
  <domain>.controller.ts
  <domain>.service.ts
  <domain>.repository.ts
  <domain>.validation.ts
  models/          # optional if not shared
  types/
  index.ts
```

Register routes only through `src/routes/index.ts` (or a module barrel imported there).

Placeholder domains (not implemented yet):

- organizations
- branches
- vehicles
- customers
- bookings
- contracts
- invoices
- payments
- vendors
- expenses
- service
- fines
- tolls
- accounting
- vat
- investors
- hr
- notifications
- integrations
- reports
