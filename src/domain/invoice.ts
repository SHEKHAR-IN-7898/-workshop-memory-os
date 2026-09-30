export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "VOID";

const transitions: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  DRAFT: ["ISSUED", "VOID"],
  ISSUED: ["PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"],
  PARTIALLY_PAID: ["PAID", "OVERDUE", "VOID"],
  PAID: ["VOID"],
  OVERDUE: ["PARTIALLY_PAID", "PAID", "VOID"],
  VOID: [],
};

export function canTransitionInvoice(
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean {
  return transitions[from].includes(to);
}

export function assertInvoiceTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
): void {
  if (!canTransitionInvoice(from, to)) {
    throw new Error(`Invalid invoice transition: ${from} -> ${to}`);
  }
}
