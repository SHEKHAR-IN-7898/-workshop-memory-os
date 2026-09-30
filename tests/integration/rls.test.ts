import "dotenv/config";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { prisma } from "../../src/db/client.js";
import { withTenantTransaction } from "../../src/db/tenant.js";

const directUrl = process.env.DIRECT_DATABASE_URL;

const integration = directUrl ? describe : describe.skip;

integration("PostgreSQL RLS tenant isolation", () => {
  const admin = directUrl
    ? new PrismaClient({ adapter: new PrismaPg({ connectionString: directUrl }) })
    : null;

  it("cannot read another tenant through the application connection", async () => {
    if (!admin) return;

    const tenantA = await admin.tenant.create({
      data: { name: "RLS Test A", slug: `rls-a-${randomUUID()}` },
    });
    const tenantB = await admin.tenant.create({
      data: { name: "RLS Test B", slug: `rls-b-${randomUUID()}` },
    });

    try {
      await admin.customer.create({
        data: { tenantId: tenantA.id, name: "Customer A" },
      });
      await admin.customer.create({
        data: { tenantId: tenantB.id, name: "Customer B" },
      });

      const ownRows = await withTenantTransaction(prisma, tenantA.id, (tx) =>
        tx.customer.findMany({ orderBy: { name: "asc" } }),
      );
      expect(ownRows).toHaveLength(1);
      expect(ownRows[0]?.name).toBe("Customer A");

      const leakedRows = await withTenantTransaction(prisma, tenantA.id, (tx) =>
        tx.customer.findMany({
          where: { tenantId: tenantB.id },
        }),
      );
      expect(leakedRows).toHaveLength(0);

      await expect(
        withTenantTransaction(prisma, tenantA.id, (tx) =>
          tx.customer.create({
            data: { tenantId: tenantB.id, name: "Injected Cross Tenant" },
          }),
        ),
      ).rejects.toThrow();
    } finally {
      await admin.customer.deleteMany({
        where: { tenantId: { in: [tenantA.id, tenantB.id] } },
      });
      await admin.tenant.deleteMany({
        where: { id: { in: [tenantA.id, tenantB.id] } },
      });
    }
  });

  it("keeps tenant context isolated across concurrent transactions", async () => {
    if (!admin) return;

    const tenants = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        admin.tenant.create({
          data: { name: `Concurrent ${i}`, slug: `rls-concurrent-${randomUUID()}` },
        }),
      ),
    );

    try {
      await Promise.all(
        tenants.map((tenant) =>
          admin!.customer.create({
            data: { tenantId: tenant.id, name: `Customer-${tenant.id}` },
          }),
        ),
      );

      const results = await Promise.all(
        tenants.map((tenant) =>
          withTenantTransaction(prisma, tenant.id, async (tx) => {
            const rows = await tx.customer.findMany();
            return { tenantId: tenant.id, rows };
          }),
        ),
      );

      for (const result of results) {
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]?.tenantId).toBe(result.tenantId);
      }
    } finally {
      await admin.customer.deleteMany({
        where: { tenantId: { in: tenants.map((tenant) => tenant.id) } },
      });
      await admin.tenant.deleteMany({
        where: { id: { in: tenants.map((tenant) => tenant.id) } },
      });
    }
  });

  it("fails closed when no tenant context is set", async () => {
    if (!admin) return;

    const tenant = await admin.tenant.create({
      data: { name: "RLS Test Missing Context", slug: `rls-missing-${randomUUID()}` },
    });

    try {
      await admin.customer.create({
        data: { tenantId: tenant.id, name: "Hidden Customer" },
      });

      await expect(prisma.customer.findMany()).resolves.toEqual([]);
    } finally {
      await admin.customer.deleteMany({ where: { tenantId: tenant.id } });
      await admin.tenant.delete({ where: { id: tenant.id } });
    }
  });
});
