import type { PrismaClient } from "../generated/prisma/client";
import { withTenantTransaction } from "../db/tenant";

export async function searchWorkshop(
  prisma: PrismaClient,
  tenantId: string,
  query: string,
  vehicleId?: string,
  customerId?: string,
) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);

  return withTenantTransaction(prisma, tenantId, async (tx) => {
    const [customers, vehicles, services, invoices] = await Promise.all([
      tx.customer.findMany({
        where: {
          ...(customerId ? { id: customerId } : {}),
          OR: terms.flatMap((term) => [
            { name: { contains: term, mode: "insensitive" as const } },
            { phone: { contains: term, mode: "insensitive" as const } },
            { email: { contains: term, mode: "insensitive" as const } },
          ]),
        },
        take: 20,
      }),
      tx.vehicle.findMany({
        where: {
          ...(vehicleId ? { id: vehicleId } : {}),
          OR: terms.flatMap((term) => [
            { registration: { contains: term, mode: "insensitive" as const } },
            { vin: { contains: term, mode: "insensitive" as const } },
            { make: { contains: term, mode: "insensitive" as const } },
            { model: { contains: term, mode: "insensitive" as const } },
          ]),
        },
        take: 20,
      }),
      tx.serviceRecord.findMany({
        where: {
          ...(vehicleId ? { vehicleId } : {}),
          OR: terms.flatMap((term) => [
            { complaint: { contains: term, mode: "insensitive" as const } },
            { diagnosis: { contains: term, mode: "insensitive" as const } },
            { workPerformed: { contains: term, mode: "insensitive" as const } },
          ]),
        },
        orderBy: { serviceDate: "desc" },
        take: 30,
      }),
      tx.invoice.findMany({
        where: {
          ...(vehicleId ? { vehicleId } : {}),
          OR: terms.map((term) => ({
            invoiceNumber: { contains: term, mode: "insensitive" as const },
          })),
        },
        orderBy: { issueDate: "desc" },
        take: 20,
        select: { id:true, invoiceNumber:true, issueDate:true, total:true, status:true, vehicleId:true },
      }),
    ]);
    return { customers, vehicles, services, invoices };
  });
}
