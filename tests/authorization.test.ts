// tests/authorization.test.ts
// Checks the permission rules (TDD 6.2) and the guards (TDD 5.3).

import { describe, it, expect } from "vitest";
import { can, getScope, PERMISSIONS, ROLES, HOME_PAGE } from "../src/server/auth/permissions";
import {
  AuthError,
  requireUser,
  requireRole,
  requireRecordAccess,
  type SessionUser,
} from "../src/server/auth/guards";

describe("Permission matrix (TDD 6.2)", () => {
  // --- Things that MUST be allowed ---
  it("Operator can generate bills and manage tariffs", () => {
    expect(can("OPERATOR", "bills:generate")).toBe(true);
    expect(can("OPERATOR", "tariffs:manage")).toBe(true);
  });

  it("Meter reader can submit readings, only on assigned routes", () => {
    expect(getScope("METER_READER", "readings:submit")).toBe("ASSIGNED_ROUTES");
  });

  it("Payment collector can record payments, only on assigned routes", () => {
    expect(getScope("PAYMENT_COLLECTOR", "payments:record")).toBe("ASSIGNED_ROUTES");
  });

  it("Subscriber can view only their OWN bills and payments", () => {
    expect(getScope("SUBSCRIBER", "bills:view")).toBe("OWN");
    expect(getScope("SUBSCRIBER", "payments:view")).toBe("OWN");
  });

  // --- Things that MUST be denied (T-13 rules) ---
  it("Collector cannot generate bills or edit readings", () => {
    expect(can("PAYMENT_COLLECTOR", "bills:generate")).toBe(false);
    expect(can("PAYMENT_COLLECTOR", "readings:submit")).toBe(false);
    expect(can("PAYMENT_COLLECTOR", "readings:review")).toBe(false);
  });

  it("Meter reader cannot record payments, manage tariffs or generate bills", () => {
    expect(can("METER_READER", "payments:record")).toBe(false);
    expect(can("METER_READER", "tariffs:manage")).toBe(false);
    expect(can("METER_READER", "bills:generate")).toBe(false);
  });

  it("Subscriber cannot open the dashboard or change anything", () => {
    const writeActions = [
      "users:manage", "setup:manage", "routes:assignStaff", "readings:submit",
      "readings:review", "tariffs:manage", "bills:generate", "payments:record",
    ] as const;
    expect(can("SUBSCRIBER", "dashboard:view")).toBe(false);
    for (const action of writeActions) {
      expect(can("SUBSCRIBER", action)).toBe(false);
    }
  });

  it("Operator cannot submit readings or record payments (staff do that)", () => {
    expect(can("OPERATOR", "readings:submit")).toBe(false);
    expect(can("OPERATOR", "payments:record")).toBe(false);
  });

  it("Nobody can edit or delete a recorded payment", () => {
    const actions = Object.keys(PERMISSIONS);
    expect(actions).not.toContain("payments:edit");
    expect(actions).not.toContain("payments:delete");
  });

  // --- Login redirect ---
  it("Every role has a home page to go to after login", () => {
    for (const role of ROLES) {
      expect(HOME_PAGE[role]).toMatch(/^\//);
    }
  });
});

// ---------------------------------------------------------------------------
// Guards (TDD 5.3) — fake users only, no database needed yet
// ---------------------------------------------------------------------------

const operator: SessionUser = { id: "u-operator", role: "OPERATOR", fullName: "Test Operator" };
const reader: SessionUser = { id: "u-reader", role: "METER_READER", fullName: "Test Reader" };
const collector: SessionUser = { id: "u-collector", role: "PAYMENT_COLLECTOR", fullName: "Test Collector" };
const s2: SessionUser = { id: "u-s2", role: "SUBSCRIBER", fullName: "Subscriber S2" };

// Records belonging to two subscribers on two different routes
const s2Record = { routeId: "route-A", ownerUserId: "u-s2" };
const s3Record = { routeId: "route-B", ownerUserId: "u-s3" };

// Helper: runs a guard and returns the error code it threw, or null if it allowed the action
function refusal(guard: () => unknown): string | null {
  try {
    guard();
    return null;
  } catch (error) {
    return error instanceof AuthError ? error.code : "UNEXPECTED_ERROR";
  }
}

describe("Guards (TDD 5.3)", () => {
  it("T-11: no session is refused with UNAUTHENTICATED (401)", () => {
    expect(refusal(() => requireUser(null))).toBe("UNAUTHENTICATED");
    expect(refusal(() => requireRole(undefined, "bills:view"))).toBe("UNAUTHENTICATED");
    expect(new AuthError("UNAUTHENTICATED").status).toBe(401);
  });

  it("T-13: wrong role is refused with FORBIDDEN (403)", () => {
    expect(refusal(() => requireRole(collector, "bills:generate"))).toBe("FORBIDDEN");
    expect(refusal(() => requireRole(reader, "payments:record"))).toBe("FORBIDDEN");
    expect(refusal(() => requireRole(s2, "dashboard:view"))).toBe("FORBIDDEN");
    expect(new AuthError("FORBIDDEN").status).toBe(403);
  });

  it("Allowed role gets its scope back", () => {
    expect(requireRole(operator, "bills:generate")).toBe("ALL");
    expect(requireRole(reader, "readings:submit")).toBe("ASSIGNED_ROUTES");
    expect(requireRole(s2, "bills:view")).toBe("OWN");
  });

  it("T-14: reader assigned only to Route A cannot submit for Route B", () => {
    const scope = requireRole(reader, "readings:submit");
    expect(refusal(() => requireRecordAccess(scope, reader, s3Record, ["route-A"]))).toBe("FORBIDDEN");
    expect(refusal(() => requireRecordAccess(scope, reader, s2Record, ["route-A"]))).toBeNull();
  });

  it("T-15: subscriber S2 cannot see S3's bill, and gets NOT_FOUND (404)", () => {
    const scope = requireRole(s2, "bills:view");
    expect(refusal(() => requireRecordAccess(scope, s2, s3Record))).toBe("NOT_FOUND");
    expect(refusal(() => requireRecordAccess(scope, s2, s2Record))).toBeNull();
    expect(new AuthError("NOT_FOUND").status).toBe(404);
  });

  it("Operator can access any subscriber's records", () => {
    const scope = requireRole(operator, "bills:view");
    expect(refusal(() => requireRecordAccess(scope, operator, s3Record))).toBeNull();
  });
});