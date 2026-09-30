import { describe, expect, it } from "vitest";
import { canTransitionInvoice } from "../../src/domain/invoice.js";

describe("invoice lifecycle", () => {
  it("allows draft to be issued", () => {
    expect(canTransitionInvoice("DRAFT", "ISSUED")).toBe(true);
  });

  it("does not allow paid invoices to become draft", () => {
    expect(canTransitionInvoice("PAID", "DRAFT")).toBe(false);
  });

  it("does not allow void invoices to be changed", () => {
    expect(canTransitionInvoice("VOID", "PAID")).toBe(false);
  });
});
