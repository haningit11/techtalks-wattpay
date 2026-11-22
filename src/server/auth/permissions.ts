// src/server/auth/permissions.ts
// WattPay permission rules — the code version of TDD Section 6.2.
// Rule: DENY BY DEFAULT. If a role is not listed for an action, it is not allowed.

// 1. The four roles (must match the role values in the database)
export const ROLES = ["OPERATOR", "METER_READER", "PAYMENT_COLLECTOR", "SUBSCRIBER"] as const;
export type Role = (typeof ROLES)[number];

// 2. How much data a role may touch for an action
//    ALL             = every record
//    ASSIGNED_ROUTES = only subscribers on the user's assigned routes
//    OWN             = only the subscriber's own records
export type Scope = "ALL" | "ASSIGNED_ROUTES" | "OWN";

// 3. The permission matrix
export const PERMISSIONS = {
  "users:manage":       { OPERATOR: "ALL" },
  "setup:manage":       { OPERATOR: "ALL" }, // buildings, routes, subscribers, subscriptions
  "routes:assignStaff": { OPERATOR: "ALL" },
  "subscribers:view":   { OPERATOR: "ALL", METER_READER: "ASSIGNED_ROUTES", PAYMENT_COLLECTOR: "ASSIGNED_ROUTES", SUBSCRIBER: "OWN" },
  "readings:submit":    { METER_READER: "ASSIGNED_ROUTES" },
  "readings:view":      { OPERATOR: "ALL", METER_READER: "ASSIGNED_ROUTES", SUBSCRIBER: "OWN" },
  "readings:review":    { OPERATOR: "ALL" },
  "tariffs:manage":     { OPERATOR: "ALL" },
  "bills:generate":     { OPERATOR: "ALL" },
  "bills:view":         { OPERATOR: "ALL", PAYMENT_COLLECTOR: "ASSIGNED_ROUTES", SUBSCRIBER: "OWN" },
  "payments:record":    { PAYMENT_COLLECTOR: "ASSIGNED_ROUTES" },
  "payments:view":      { OPERATOR: "ALL", PAYMENT_COLLECTOR: "ASSIGNED_ROUTES", SUBSCRIBER: "OWN" },
  "dashboard:view":     { OPERATOR: "ALL" },
  "auditLog:view":      { OPERATOR: "ALL" },
  // Editing or deleting a recorded payment is intentionally missing: nobody can do it.
} as const satisfies Record<string, Partial<Record<Role, Scope>>>;

export type Action = keyof typeof PERMISSIONS;

// 4. Helper functions the guards will use
export function getScope(role: Role, action: Action): Scope | null {
  const rules: Partial<Record<Role, Scope>> = PERMISSIONS[action];
  return rules[role] ?? null; // null = not allowed
}

export function can(role: Role, action: Action): boolean {
  return getScope(role, action) !== null;
}

// 5. Where each role goes after login (used by src/app/page.tsx)
export const HOME_PAGE: Record<Role, string> = {
  OPERATOR: "/admin",
  METER_READER: "/reader",
  PAYMENT_COLLECTOR: "/collector",
  SUBSCRIBER: "/portal",
};