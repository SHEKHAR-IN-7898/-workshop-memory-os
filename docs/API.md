# Workshop Memory OS API

Base URL: `http://localhost:3000`

## Auth

### Register
`POST /api/v1/auth/register`

```json
{
  "email": "owner@example.com",
  "password": "change-this-password",
  "displayName": "Workshop Owner",
  "workshopName": "Example Auto Care",
  "workshopSlug": "example-auto-care"
}
```

### Login
`POST /api/v1/auth/login`

Optional `workshopSlug` selects a membership when a user belongs to multiple workshops.

All protected endpoints use:

`Authorization: Bearer <token>`

## Records

- `POST /api/v1/customers`
- `POST /api/v1/vehicles`
- `GET /api/v1/search?q=...`
- `GET /api/v1/analytics/overview`

## Imports

`POST /api/v1/import/csv`

Body:

```json
{ "type": "customers", "csv": "name,phone\nAsha,9999999999" }
```

Supported types: `customers`, `vehicles`, `services`, `invoices`.

`POST /api/v1/documents/pdf` accepts a base64 PDF and stores bounded extracted text as a tenant-scoped MemoryDocument.

## AI

`POST /api/v1/ai/ask`

```json
{
  "question": "What work was done on this vehicle?"
}
```

The retrieval layer runs first. The AI provider receives only the resulting evidence and is instructed not to invent missing facts. Without `OPENAI_API_KEY`, the endpoint returns a deterministic evidence summary.

## Invoice controls

`POST /api/v1/invoices/void`

Requires `invoice:void` permission and an explicit reason. The update uses the invoice version as an optimistic concurrency check and writes an audit event.
