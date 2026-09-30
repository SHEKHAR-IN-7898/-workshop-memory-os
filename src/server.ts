import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "./db/client";
import { withTenantTransaction } from "./db/tenant";
import { registerSchema, loginSchema, customerSchema, vehicleSchema, questionSchema, importSchema } from "./validation";
import { hashPassword, verifyPassword } from "./security/password";
import { signSession, verifySession } from "./security/jwt";
import { assertPermission, type Role } from "./security/permissions";
import { searchWorkshop } from "./retrieval/search";
import { answerWithEvidence } from "./ai/provider";
import { parseCsv, requiredColumns } from "./import/csv";
import { extractPdf } from "./import/pdf";

const port = Number(process.env.PORT ?? 3000);
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const zVoidInvoice = z.object({
  invoiceId: z.string().uuid(),
  reason: z.string().trim().min(3).max(1000),
});

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
function token(req: IncomingMessage) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) throw new Error("Authentication required");
  return h.slice(7);
}
async function session(req: IncomingMessage) {
  return verifySession(token(req));
}
function role(s: Awaited<ReturnType<typeof session>>): Role {
  if (!["OWNER","ADMIN","MANAGER","TECHNICIAN","STAFF","VIEWER"].includes(s.role)) throw new Error("Invalid role");
  return s.role as Role;
}

const server = createServer(async (req, res) => {
  const requestId = randomUUID();
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const method = req.method ?? "GET";

    if (method === "GET" && url.pathname === "/login") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(await readFile(join(publicDir, "login.html"), "utf8"));
    }
    if (method === "GET" && url.pathname === "/dashboard") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(await readFile(join(publicDir, "index.html"), "utf8"));
    }
    if (method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, requestId });
    if (method === "GET" && url.pathname === "/") return send(res, 200, {
      name: "Workshop Memory OS", status: "running", api: "v1",
      phases: ["auth","workshop","records","imports","retrieval","ai","analytics","security"],
    });

    if (method === "POST" && url.pathname === "/api/v1/auth/register") {
      const input = registerSchema.parse(await body(req));
      const passwordHash = await hashPassword(input.password);
      const rows = await prisma.$queryRaw<Array<{ user_id: string; tenant_id: string; role: "OWNER" }>>`
        SELECT * FROM public.provision_owner(${input.email.toLowerCase()}, ${input.displayName ?? ""}, ${passwordHash}, ${input.workshopName}, ${input.workshopSlug})
      `;
      const result = rows[0];
      if (!result) throw new Error("Registration failed");
      const sessionToken = await signSession({ userId: result.user_id, tenantId: result.tenant_id, role: result.role });
      return send(res, 201, { token: sessionToken, user: { id: result.user_id, email: input.email.toLowerCase() }, tenant: { id: result.tenant_id, name: input.workshopName, slug: input.workshopSlug } });
    }

    if (method === "POST" && url.pathname === "/api/v1/auth/login") {
      const input = loginSchema.parse(await body(req));
      const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
      if (!user || user.status !== "ACTIVE" || !(await verifyPassword(input.password, user.passwordHash))) return send(res, 401, { error: "Invalid credentials" });
      const memberships = await prisma.$queryRaw<Array<{ tenant_id: string; tenant_name: string; role: Role }>>`
        SELECT * FROM public.get_user_memberships(${user.id})
      `;
      const m = input.workshopSlug
        ? memberships.find(x => x.tenant_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") === input.workshopSlug)
        : memberships[0];
      if (!m) return send(res, 401, { error: "No active workshop membership" });
      const sessionToken = await signSession({ userId: user.id, tenantId: m.tenant_id, role: m.role });
      return send(res, 200, { token: sessionToken, user: { id: user.id, email: user.email, displayName: user.displayName }, tenantId: m.tenant_id, role: m.role });
    }

    const s = await session(req);
    const r = role(s);

    if (method === "GET" && url.pathname === "/api/v1/me") {
      const me = await withTenantTransaction(prisma, s.tenantId, async (tx) => {
        const m = await tx.membership.findUnique({ where: { tenantId_userId: { tenantId: s.tenantId, userId: s.userId } }, include: { tenant: true, user: true } });
        if (!m || m.status !== "ACTIVE") throw new Error("Membership revoked");
        return { user: { id:m.user.id,email:m.user.email,displayName:m.user.displayName }, tenant:{id:m.tenant.id,name:m.tenant.name,slug:m.tenant.slug}, role:m.role };
      });
      return send(res, 200, me);
    }

    if (method === "POST" && url.pathname === "/api/v1/customers") {
      assertPermission(r, "customer:write");
      const input = customerSchema.parse(await body(req));
      const customer = await withTenantTransaction(prisma, s.tenantId, tx => tx.customer.create({ data: { tenantId:s.tenantId, ...input } }));
      return send(res, 201, customer);
    }

    if (method === "POST" && url.pathname === "/api/v1/vehicles") {
      assertPermission(r, "vehicle:write");
      const input = vehicleSchema.parse(await body(req));
      const vehicle = await withTenantTransaction(prisma, s.tenantId, tx => tx.vehicle.create({ data: { tenantId:s.tenantId, ...input } }));
      return send(res, 201, vehicle);
    }

    if (method === "GET" && url.pathname === "/api/v1/search") {
      assertPermission(r, "customer:read");
      const q = url.searchParams.get("q") ?? "";
      if (q.length < 2) return send(res, 400, { error: "q must contain at least 2 characters" });
      const result = await searchWorkshop(prisma, s.tenantId, q, url.searchParams.get("vehicleId") ?? undefined, url.searchParams.get("customerId") ?? undefined);
      return send(res, 200, result);
    }

    if (method === "POST" && url.pathname === "/api/v1/ai/ask") {
      assertPermission(r, "customer:read");
      const input = questionSchema.parse(await body(req));
      const result = await searchWorkshop(prisma, s.tenantId, input.question, input.vehicleId, input.customerId);
      const evidence = [
        ...result.customers.map(x => ({ type:"customer", id:x.id, text:`Customer ${x.name}; phone ${x.phone ?? "unknown"}` })),
        ...result.vehicles.map(x => ({ type:"vehicle", id:x.id, text:`Vehicle ${x.registration}; ${[x.make,x.model,x.variant].filter(Boolean).join(" ")}` })),
        ...result.services.map(x => ({ type:"service", id:x.id, text:`Service ${x.serviceDate.toISOString().slice(0,10)}; complaint: ${x.complaint ?? "none"}; diagnosis: ${x.diagnosis ?? "none"}; work: ${x.workPerformed ?? "none"}` })),
        ...result.invoices.map(x => ({ type:"invoice", id:x.id, text:`Invoice ${x.invoiceNumber}; date ${x.issueDate.toISOString().slice(0,10)}; total ${x.total}; status ${x.status}` })),
      ];
      return send(res, 200, await answerWithEvidence(input.question, evidence));
    }

    if (method === "POST" && url.pathname === "/api/v1/import/csv") {
      assertPermission(r, "documents:write");
      const input = importSchema.parse(await body(req));
      const rows = parseCsv(input.csv);
      const counts = { created:0, skipped:0, errors:[] as string[] };
      await withTenantTransaction(prisma, s.tenantId, async tx => {
        if (input.type === "customers") {
          requiredColumns(rows, ["name"]);
          for (const row of rows) {
            try { await tx.customer.create({ data:{ tenantId:s.tenantId, name:row.name!, phone:row.phone || undefined, email:row.email || undefined, address:row.address || undefined }}); counts.created++; }
            catch (e) { counts.skipped++; counts.errors.push(String(e)); }
          }
        } else if (input.type === "vehicles") {
          requiredColumns(rows, ["customerId","registration"]);
          for (const row of rows) {
            try { await tx.vehicle.create({ data:{ tenantId:s.tenantId, customerId:row.customerId!, registration:row.registration!, vin:row.vin || undefined, make:row.make || undefined, model:row.model || undefined }}); counts.created++; }
            catch (e) { counts.skipped++; counts.errors.push(String(e)); }
          }
        } else if (input.type === "services") {
          requiredColumns(rows, ["vehicleId","serviceDate"]);
          for (const row of rows) {
            try { await tx.serviceRecord.create({ data:{ tenantId:s.tenantId, vehicleId:row.vehicleId!, serviceDate:new Date(row.serviceDate!), complaint:row.complaint || undefined, diagnosis:row.diagnosis || undefined, workPerformed:row.workPerformed || undefined }}); counts.created++; }
            catch (e) { counts.skipped++; counts.errors.push(String(e)); }
          }
        } else {
          requiredColumns(rows, ["invoiceNumber","customerId","vehicleId","issueDate","subtotal","total"]);
          for (const row of rows) {
            try { await tx.invoice.create({ data:{ tenantId:s.tenantId, invoiceNumber:row.invoiceNumber!, customerId:row.customerId!, vehicleId:row.vehicleId!, issueDate:new Date(row.issueDate!), subtotal:row.subtotal!, total:row.total!, balanceDue:row.balanceDue || row.total! }}); counts.created++; }
            catch (e) { counts.skipped++; counts.errors.push(String(e)); }
          }
        }
        await tx.auditEvent.create({ data:{ tenantId:s.tenantId, actorUserId:s.userId, action:"CSV_IMPORT", entityType:input.type, metadata:{ rows:rows.length, counts }, requestId } });
      });
      return send(res, 200, counts);
    }

        if (method === "GET" && url.pathname === "/api/v1/analytics/overview") {
      assertPermission(r, "customer:read");
      const overview = await withTenantTransaction(prisma, s.tenantId, async tx => {
        const [customers, vehicles, services, invoices, revenue] = await Promise.all([
          tx.customer.count(), tx.vehicle.count(), tx.serviceRecord.count(), tx.invoice.count(),
          tx.invoice.aggregate({ _sum: { total: true, amountPaid: true, balanceDue: true } }),
        ]);
        return { customers, vehicles, services, invoices, revenue };
      });
      return send(res, 200, overview);
    }

    if (method === "POST" && url.pathname === "/api/v1/documents/pdf") {
      assertPermission(r, "documents:write");
      const input = await body(req);
      if (typeof input.base64 !== "string" || input.base64.length < 20) return send(res, 400, { error: "base64 PDF is required" });
      const buffer = Buffer.from(input.base64, "base64");
      const extracted = await extractPdf(buffer);
      const document = await withTenantTransaction(prisma, s.tenantId, tx =>
        tx.memoryDocument.create({
          data: {
            tenantId: s.tenantId,
            documentType: input.documentType === "SERVICE_REPORT" ? "SERVICE_REPORT" : "INVOICE",
            storageKey: input.storageKey ?? `inline/${extracted.sha256}.pdf`,
            originalName: input.originalName ?? `${extracted.sha256}.pdf`,
            mimeType: "application/pdf",
            sha256: extracted.sha256,
            sizeBytes: BigInt(buffer.length),
            extractionStatus: "COMPLETED",
            extractedText: extracted.text,
            extractedData: { pages: extracted.pages },
          },
        }),
      );
      return send(res, 201, { id: document.id, sha256: extracted.sha256, pages: extracted.pages, characters: extracted.text.length });
    }

    if (method === "POST" && url.pathname === "/api/v1/invoices/void") {
      assertPermission(r, "invoice:void");
      const input = zVoidInvoice.parse(await body(req));
      const result = await withTenantTransaction(prisma, s.tenantId, async tx => {
        const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
        if (!invoice) throw new Error("Invoice not found");
        if (invoice.status === "VOID") throw new Error("Invoice already void");
        const updated = await tx.invoice.updateMany({
          where: { id: invoice.id, tenantId: s.tenantId, version: invoice.version, status: invoice.status },
          data: { status: "VOID", version: { increment: 1 }, voidedAt: new Date(), voidReason: input.reason },
        });
        if (updated.count !== 1) throw new Error("Concurrent invoice update detected; retry");
        await tx.auditEvent.create({ data: {
          tenantId: s.tenantId, actorUserId: s.userId, action: "INVOICE_VOID",
          entityType: "Invoice", entityId: invoice.id, requestId, metadata: { reason: input.reason, previousStatus: invoice.status, previousVersion: invoice.version },
        }});
        return { ok: true, invoiceId: invoice.id };
      });
      return send(res, 200, result);
    }

    return send(res, 404, { error:"Not found", requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    const status = /Authentication|required|Forbidden|Invalid session|Membership revoked/.test(message) ? 401 : 400;
    return send(res, status, { error: message, requestId });
  }
});

server.listen(port, () => console.log(`Workshop Memory OS API listening on :${port}`));
