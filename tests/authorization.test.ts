// tests/authorization.test.ts
// Checks the permission rules in src/server/auth/permissions.ts (TDD Section 6.2).

import { describe, it, expect } from "vitest";
import { can, getScope, PERMISSIONS, ROLES, HOME_PAGE } from "../src/server/auth/permissions";

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