# Workshop Memory OS

AI-powered business memory for automobile workshops.

## Implemented product phases

1. **Auth + workshop onboarding** — registration, login, signed sessions, membership revalidation.
2. **Customer / vehicle / service APIs** — tenant-safe CRUD foundation and validation.
3. **Invoice security** — explicit permissions, version field, void workflow, audit events.
4. **CSV/Excel-style imports** — CSV ingestion with per-row error reporting and audit logging.
5. **PDF extraction** — bounded PDF text extraction into tenant-scoped memory documents.
6. **Workshop memory retrieval** — tenant-safe lexical search across customer, vehicle, service, and invoice evidence.
7. **Business analytics** — overview metrics for customers, vehicles, services, invoices, and revenue.
8. **Evidence-grounded AI** — OpenAI Responses API provider with a deterministic local fallback when no API key is configured.
9. **Dashboard** — browser dashboard for analytics, search, and AI questions.
10. **Production hardening** — PostgreSQL RLS, restricted runtime role, transaction-local tenant context, stale-membership checks, request limits, security headers, concurrency-safe invoice voiding, and CI security tests.

This is a complete functional MVP foundation. OCR for scanned/image-only PDFs, object storage, background job workers, vector search, distributed rate limiting, and advanced import adapters are deliberately separate scale-up components.

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

After migrations, grant the runtime role its table/function privileges from `prisma/runtime-grants.sql`. The authentication provisioning functions are SECURITY DEFINER functions with a fixed `search_path`; their EXECUTE privilege is intentionally not granted to PUBLIC.

## Scale-up components

The functional MVP is in place. The following are deliberately deferred until real workshop usage justifies the operational complexity:

- OCR for scanned/image-only PDFs
- S3-compatible object storage and signed URLs
- Background job workers and retry queues
- pgvector semantic retrieval and hybrid search
- Distributed Redis rate limiting
- Source-specific import adapters
- Advanced RBAC administration and customer portal
- Production observability, backups, and disaster-recovery automation

These are scale-up layers, not missing foundations.

## Brutal product reality

This is not yet a proven business. The first meaningful validation is 1–3 real workshops, their actual exported data, the amount of manual cleanup required, and whether they will pay for a measurable workflow improvement.

Technical sophistication is not the success metric. Repeat usage, time saved, data accuracy, and willingness to pay are.
