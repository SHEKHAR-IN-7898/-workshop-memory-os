-- Initial PostgreSQL schema for Workshop Memory OS.
-- RLS is enabled in the same migration so a partially deployed database
-- cannot accidentally run without tenant isolation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE','SUSPENDED','DELETED');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE','DISABLED');
CREATE TYPE "MembershipRole" AS ENUM ('OWNER','ADMIN','MANAGER','TECHNICIAN','STAFF','VIEWER');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE','INVITED','SUSPENDED','REMOVED');
CREATE TYPE "FuelType" AS ENUM ('PETROL','DIESEL','CNG','ELECTRIC','HYBRID','LPG','OTHER');
CREATE TYPE "ServiceStatus" AS ENUM ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT','ISSUED','PARTIALLY_PAID','PAID','OVERDUE','VOID');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH','CARD','UPI','BANK_TRANSFER','OTHER');
CREATE TYPE "LineItemType" AS ENUM ('PART','LABOR','SERVICE','DISCOUNT','OTHER');
CREATE TYPE "DocumentType" AS ENUM ('INVOICE','SERVICE_REPORT','CUSTOMER_NOTE','CHAT_EXPORT','OTHER');
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED');

CREATE TABLE "Tenant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "passwordHash" TEXT NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Membership" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "MembershipRole" NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON "Membership"("tenantId","userId");
CREATE INDEX "Membership_tenantId_role_idx" ON "Membership"("tenantId","role");
CREATE INDEX "Membership_tenantId_status_idx" ON "Membership"("tenantId","status");

CREATE TABLE "Customer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Customer_tenantId_id_key" ON "Customer"("tenantId","id");
CREATE INDEX "Customer_tenantId_phone_idx" ON "Customer"("tenantId","phone");
CREATE INDEX "Customer_tenantId_email_idx" ON "Customer"("tenantId","email");
CREATE INDEX "Customer_tenantId_name_idx" ON "Customer"("tenantId","name");

CREATE TABLE "Vehicle" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "registration" TEXT NOT NULL,
  "vin" TEXT,
  "make" TEXT,
  "model" TEXT,
  "variant" TEXT,
  "modelYear" INTEGER,
  "fuelType" "FuelType",
  "odometerKm" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Vehicle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Vehicle_tenantId_customerId_fkey" FOREIGN KEY ("tenantId","customerId") REFERENCES "Customer"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Vehicle_tenantId_id_key" ON "Vehicle"("tenantId","id");
CREATE UNIQUE INDEX "Vehicle_tenantId_registration_key" ON "Vehicle"("tenantId","registration");
CREATE INDEX "Vehicle_tenantId_customerId_idx" ON "Vehicle"("tenantId","customerId");
CREATE INDEX "Vehicle_tenantId_vin_idx" ON "Vehicle"("tenantId","vin");

CREATE TABLE "Technician" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "employeeCode" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Technician_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Technician_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Technician_tenantId_id_key" ON "Technician"("tenantId","id");
CREATE UNIQUE INDEX "Technician_tenantId_employeeCode_key" ON "Technician"("tenantId","employeeCode");
CREATE INDEX "Technician_tenantId_active_idx" ON "Technician"("tenantId","active");

CREATE TABLE "ServiceRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "vehicleId" UUID NOT NULL,
  "technicianId" UUID,
  "serviceDate" TIMESTAMP(3) NOT NULL,
  "odometerKm" INTEGER,
  "complaint" TEXT,
  "diagnosis" TEXT,
  "workPerformed" TEXT,
  "status" "ServiceStatus" NOT NULL DEFAULT 'COMPLETED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServiceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ServiceRecord_tenantId_vehicleId_fkey" FOREIGN KEY ("tenantId","vehicleId") REFERENCES "Vehicle"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ServiceRecord_tenantId_technicianId_fkey" FOREIGN KEY ("tenantId","technicianId") REFERENCES "Technician"("tenantId","id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ServiceRecord_tenantId_id_key" ON "ServiceRecord"("tenantId","id");
CREATE INDEX "ServiceRecord_tenantId_vehicleId_serviceDate_idx" ON "ServiceRecord"("tenantId","vehicleId","serviceDate");
CREATE INDEX "ServiceRecord_tenantId_technicianId_serviceDate_idx" ON "ServiceRecord"("tenantId","technicianId","serviceDate");

CREATE TABLE "MemoryDocument" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "documentType" "DocumentType" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
  "extractedText" TEXT,
  "extractedData" JSONB,
  "sourceCreatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemoryDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MemoryDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MemoryDocument_tenantId_id_key" ON "MemoryDocument"("tenantId","id");
CREATE UNIQUE INDEX "MemoryDocument_tenantId_sha256_key" ON "MemoryDocument"("tenantId","sha256");
CREATE INDEX "MemoryDocument_tenantId_documentType_createdAt_idx" ON "MemoryDocument"("tenantId","documentType","createdAt");
CREATE INDEX "MemoryDocument_tenantId_extractionStatus_idx" ON "MemoryDocument"("tenantId","extractionStatus");

CREATE TABLE "Invoice" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "customerId" UUID NOT NULL,
  "vehicleId" UUID NOT NULL,
  "serviceRecordId" UUID,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "subtotal" DECIMAL(12,2) NOT NULL,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "cgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "igst" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL,
  "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "balanceDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "finalizedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "paymentMethod" "PaymentMethod",
  "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
  "sourceDocumentId" UUID,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Invoice_tenantId_customerId_fkey" FOREIGN KEY ("tenantId","customerId") REFERENCES "Customer"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Invoice_tenantId_vehicleId_fkey" FOREIGN KEY ("tenantId","vehicleId") REFERENCES "Vehicle"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Invoice_tenantId_serviceRecordId_fkey" FOREIGN KEY ("tenantId","serviceRecordId") REFERENCES "ServiceRecord"("tenantId","id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Invoice_tenantId_sourceDocumentId_fkey" FOREIGN KEY ("tenantId","sourceDocumentId") REFERENCES "MemoryDocument"("tenantId","id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Invoice_tenantId_id_key" ON "Invoice"("tenantId","id");
CREATE UNIQUE INDEX "Invoice_tenantId_invoiceNumber_key" ON "Invoice"("tenantId","invoiceNumber");
CREATE INDEX "Invoice_tenantId_customerId_issueDate_idx" ON "Invoice"("tenantId","customerId","issueDate");
CREATE INDEX "Invoice_tenantId_vehicleId_issueDate_idx" ON "Invoice"("tenantId","vehicleId","issueDate");
CREATE INDEX "Invoice_tenantId_status_dueDate_idx" ON "Invoice"("tenantId","status","dueDate");

CREATE TABLE "Part" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "partNumber" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "unitPrice" DECIMAL(12,2),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Part_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Part_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Part_tenantId_id_key" ON "Part"("tenantId","id");
CREATE UNIQUE INDEX "Part_tenantId_partNumber_key" ON "Part"("tenantId","partNumber");
CREATE INDEX "Part_tenantId_active_idx" ON "Part"("tenantId","active");

CREATE TABLE "InvoiceLineItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "itemType" "LineItemType" NOT NULL,
  "description" TEXT NOT NULL,
  "partNumber" TEXT,
  "partId" UUID,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "lineTotal" DECIMAL(12,2) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceLineItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InvoiceLineItem_tenantId_invoiceId_fkey" FOREIGN KEY ("tenantId","invoiceId") REFERENCES "Invoice"("tenantId","id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InvoiceLineItem_tenantId_partId_fkey" FOREIGN KEY ("tenantId","partId") REFERENCES "Part"("tenantId","id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InvoiceLineItem_tenantId_id_key" ON "InvoiceLineItem"("tenantId","id");
CREATE UNIQUE INDEX "InvoiceLineItem_tenantId_invoiceId_lineNumber_key" ON "InvoiceLineItem"("tenantId","invoiceId","lineNumber");
CREATE INDEX "InvoiceLineItem_tenantId_invoiceId_idx" ON "InvoiceLineItem"("tenantId","invoiceId");
CREATE INDEX "InvoiceLineItem_tenantId_partNumber_idx" ON "InvoiceLineItem"("tenantId","partNumber");
CREATE INDEX "InvoiceLineItem_tenantId_partId_idx" ON "InvoiceLineItem"("tenantId","partId");

CREATE TABLE "AuditEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "actorUserId" UUID,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId","createdAt");
CREATE INDEX "AuditEvent_tenantId_entityType_entityId_createdAt_idx" ON "AuditEvent"("tenantId","entityType","entityId","createdAt");
CREATE INDEX "AuditEvent_tenantId_actorUserId_createdAt_idx" ON "AuditEvent"("tenantId","actorUserId","createdAt");

-- Fail-closed tenant isolation. The application must set this transaction-local
-- value through withTenantTransaction(); an unset value matches no rows.
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'Tenant','Membership','Customer','Vehicle','Technician',
    'ServiceRecord','Invoice','InvoiceLineItem','Part',
    'MemoryDocument','AuditEvent'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    IF tbl = 'Tenant' THEN
      EXECUTE 'CREATE POLICY tenant_isolation ON "Tenant" USING ("id" = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK ("id" = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)';
    ELSE
      EXECUTE format(
        'CREATE POLICY %I_tenant_isolation ON %I USING ("tenantId" = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK ("tenantId" = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)',
        lower(tbl), tbl
      );
    END IF;
  END LOOP;
END $$;

-- The application role must not be a superuser and should not own these tables.
-- Provisioning/migrations must use a separate privileged database role.


-- Controlled authentication bootstrap. The runtime role never receives direct
-- write access to Tenant/Membership for registration; it can only execute this
-- narrowly-scoped function.
CREATE OR REPLACE FUNCTION public.provision_owner(
  p_email TEXT,
  p_display_name TEXT,
  p_password_hash TEXT,
  p_workshop_name TEXT,
  p_workshop_slug TEXT
) RETURNS TABLE(user_id UUID, tenant_id UUID, role "MembershipRole")
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user UUID;
  v_tenant UUID;
BEGIN
  INSERT INTO public."User" ("email","displayName","passwordHash")
  VALUES (lower(trim(p_email)), NULLIF(trim(p_display_name), ''), p_password_hash)
  RETURNING "id" INTO v_user;

  INSERT INTO public."Tenant" ("name","slug")
  VALUES (trim(p_workshop_name), lower(trim(p_workshop_slug)))
  RETURNING "id" INTO v_tenant;

  INSERT INTO public."Membership" ("tenantId","userId","role")
  VALUES (v_tenant, v_user, 'OWNER');

  RETURN QUERY SELECT v_user, v_tenant, 'OWNER'::"MembershipRole";
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_memberships(p_user_id UUID)
RETURNS TABLE(tenant_id UUID, tenant_name TEXT, role "MembershipRole")
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT m."tenantId", t."name", m."role"
  FROM public."Membership" m
  JOIN public."Tenant" t ON t."id" = m."tenantId"
  WHERE m."userId" = p_user_id
    AND m."status" = 'ACTIVE'
    AND t."status" = 'ACTIVE'
  ORDER BY m."createdAt" ASC;
$$;

REVOKE ALL ON FUNCTION public.provision_owner(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_memberships(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_owner(TEXT,TEXT,TEXT,TEXT,TEXT) TO workshop_app;
GRANT EXECUTE ON FUNCTION public.get_user_memberships(UUID) TO workshop_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
