import type { Prisma, PrismaClient } from "../generated/prisma/client.js";

type TransactionClient = Prisma.TransactionClient;

const TENANT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertTenantId(tenantId: string): void {
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    throw new Error("Invalid tenant id");
  }
}

export async function withTenantTransaction<T>(
  prisma: PrismaClient,
  tenantId: string,
  work: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  assertTenantId(tenantId);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return work(tx);
  });
}
