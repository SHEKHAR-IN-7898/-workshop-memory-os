import { describe, expect, it } from "vitest";
import { hasPermission } from "../../src/security/permissions.js";

describe("workshop permissions", () => {
  it("does not allow technicians to void invoices", () => {
    expect(hasPermission("TECHNICIAN", "invoice:void")).toBe(false);
  });

  it("does not allow viewers to mutate customer data", () => {
    expect(hasPermission("VIEWER", "customer:write")).toBe(false);
  });

  it("allows managers to operate on invoices without void authority", () => {
    expect(hasPermission("MANAGER", "invoice:create")).toBe(true);
    expect(hasPermission("MANAGER", "invoice:void")).toBe(false);
  });
});
