# Workshop Memory OS

AI-powered business memory for automobile workshops.

## What this system is

Workshop Memory OS turns workshop exports, invoices, service records, and other business documents into structured, tenant-isolated operational memory.

Core flow:

`exports / PDFs / documents -> extraction -> normalized records -> PostgreSQL -> retrieval / analytics / AI`

The MVP deliberately starts with imports instead of WhatsApp or live OEM integrations. That keeps the first version buildable while we validate whether workshops will pay for better history, search, and operational visibility.

## Current foundation

- PostgreSQL + Prisma ORM 7
- Multi-tenant relational model
- Tenant-safe composite foreign keys
- PostgreSQL Row-Level Security (RLS)
- Transaction-local tenant context
- Audit events
- Invoice lifecycle/version fields
- Normalized parts with historical free-text part numbers preserved
- Vitest integration-test configuration

## Security invariants

1. Never accept `tenantId` as an authorization decision from the browser.
2. Derive the active tenant from the authenticated user's membership.
3. Every tenant-scoped query runs through `withTenantTransaction()`.
4. `app.current_tenant_id` is set with `set_config(..., true)`, making it transaction-local.
5. Missing tenant context must fail closed.
6. The application database role must not be a PostgreSQL superuser or table owner, otherwise RLS can be bypassed.
7. Composite foreign keys prevent a record in tenant A from referencing a parent in tenant B.
8. Privileged membership/role decisions remain application authorization concerns; RLS is the isolation boundary, not a replacement for RBAC.

## Prisma 7 setup

Prisma ORM 7 uses the `prisma-client` generator and a PostgreSQL driver adapter. The repository therefore keeps the database URL in `prisma.config.ts` and uses `@prisma/adapter-pg` at runtime.

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

Set `DATABASE_URL` to a PostgreSQL database reachable by the application.

Install:

```powershell
npm install
```

Validate and generate:

```powershell
npm run prisma:validate
npm run prisma:generate
```

Apply migrations in a development database:

```powershell
npm run db:migrate
```

For CI/production:

```powershell
npm run db:deploy
```

## Important deployment rule

Do **not** run the app with the same privileged PostgreSQL account used to run migrations.

Use a migration/provisioning role for DDL and an application role for runtime queries. The runtime role must not be a superuser and must not own the protected tables.

## What is intentionally not solved yet

- Authentication/JWT and membership provisioning
- Explicit permission matrix and API middleware
- Import adapters for specific workshop export formats
- OCR/document extraction pipeline
- Search/retrieval and evidence citations
- pgvector semantic memory
- Invoice state-transition service and concurrency tests
- Full RLS integration test suite against PostgreSQL
- CI with a real PostgreSQL service

These are the next implementation layers. The database foundation is designed so they can be added without weakening tenant isolation.

## Brutal product reality

This is not yet a proven business. The first meaningful validation is 1–3 real workshops, their actual exported data, the amount of manual cleanup required, and whether they will pay for a measurable workflow improvement.

Technical sophistication is not the success metric. Repeat usage, time saved, data accuracy, and willingness to pay are.
