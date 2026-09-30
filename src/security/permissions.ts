export type Role =
  | "OWNER"
  | "ADMIN"
  | "MANAGER"
  | "TECHNICIAN"
  | "STAFF"
  | "VIEWER";

export type Permission =
  | "customer:read"
  | "customer:write"
  | "vehicle:read"
  | "vehicle:write"
  | "service:read"
  | "service:write"
  | "invoice:read"
  | "invoice:read_cost"
  | "invoice:create"
  | "invoice:update"
  | "invoice:void"
  | "parts:read"
  | "parts:write"
  | "documents:read"
  | "documents:write"
  | "members:manage"
  | "audit:read";

const rolePermissions: Record<Role, readonly Permission[]> = {
  OWNER: [
    "customer:read","customer:write","vehicle:read","vehicle:write",
    "service:read","service:write","invoice:read","invoice:read_cost",
    "invoice:create","invoice:update","invoice:void","parts:read","parts:write",
    "documents:read","documents:write","members:manage","audit:read",
  ],
  ADMIN: [
    "customer:read","customer:write","vehicle:read","vehicle:write",
    "service:read","service:write","invoice:read","invoice:read_cost",
    "invoice:create","invoice:update","invoice:void","parts:read","parts:write",
    "documents:read","documents:write","members:manage","audit:read",
  ],
  MANAGER: [
    "customer:read","customer:write","vehicle:read","vehicle:write",
    "service:read","service:write","invoice:read","invoice:read_cost",
    "invoice:create","invoice:update","parts:read","parts:write",
    "documents:read","documents:write","audit:read",
  ],
  TECHNICIAN: [
    "customer:read","vehicle:read","service:read","service:write",
    "parts:read","documents:read",
  ],
  STAFF: [
    "customer:read","customer:write","vehicle:read","vehicle:write",
    "service:read","invoice:read","invoice:create","invoice:update",
    "parts:read","documents:read","documents:write",
  ],
  VIEWER: [
    "customer:read","vehicle:read","service:read","invoice:read",
    "parts:read","documents:read",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
}
