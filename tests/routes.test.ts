import { beforeEach, describe, expect, it, vi } from "vitest";

/* ---------- Fake database and fake login (no real Neon access) ---------- */
const { prismaMock, authMock } = vi.hoisted(() => {
  const prismaMock = {
    building: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    collectionRoute: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    userRouteAssignment: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  // A transaction just runs its function with the same fake database
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock),
  );
  return { prismaMock, authMock: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/auth", () => ({ auth: authMock }));

import { createBuildingSchema, updateBuildingSchema } from "@/lib/validators/building.schema";
import { createRouteSchema } from "@/lib/validators/route.schema";
import { createAssignmentSchema } from "@/lib/validators/assignment.schema";
import { createBuilding, getBuilding } from "@/server/services/building.service";
import {
  assignStaff,
  createRoute,
  getActiveRouteIdsForUser,
  setAssignmentActive,
} from "@/server/services/route.service";
import { POST as createBuildingApi } from "@/app/api/buildings/route";

/* ---------- Fake records ---------- */
const OPERATOR_ID = "11111111-1111-4111-8111-111111111111";
const READER_ID = "22222222-2222-4222-8222-222222222222";
const SUBSCRIBER_ID = "33333333-3333-4333-8333-333333333333";
const ROUTE_ID = "44444444-4444-4444-8444-444444444444";
const ASSIGNMENT_ID = "55555555-5555-4555-8555-555555555555";

const reader = { id: READER_ID, role: "METER_READER", isActive: true };
const activeRoute = { id: ROUTE_ID, name: "Route A", isActive: true };

beforeEach(() => {
  vi.clearAllMocks();
});

/* ---------- 1. Validation ---------- */
describe("Validation (subtask 1.1)", () => {
  it("accepts a valid building", () => {
    const result = createBuildingSchema.safeParse({
      name: "Building Al-Nour",
      address: "Demo Address - Lebanon",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a building with an empty name or missing address", () => {
    expect(createBuildingSchema.safeParse({ name: "   ", address: "X" }).success).toBe(false);
    expect(createBuildingSchema.safeParse({ name: "Al-Nour" }).success).toBe(false);
  });

  it("rejects an empty update", () => {
    expect(updateBuildingSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a route name longer than 150 characters", () => {
    expect(createRouteSchema.safeParse({ name: "A".repeat(151) }).success).toBe(false);
  });

  it("rejects an assignment with an invalid user ID", () => {
    const result = createAssignmentSchema.safeParse({ userId: "hello", routeId: ROUTE_ID });
    expect(result.success).toBe(false);
  });
});

/* ---------- 2. Buildings and routes ---------- */
describe("Buildings and routes (subtask 1.2)", () => {
  it("creates a building", async () => {
    prismaMock.building.create.mockResolvedValueOnce({ id: "b1", name: "Al-Nour" });
    const building = await createBuilding({ name: "Al-Nour", address: "Demo" });
    expect(building.name).toBe("Al-Nour");
  });

  it("returns NOT_FOUND for a building that does not exist", async () => {
    prismaMock.building.findUnique.mockResolvedValueOnce(null);
    await expect(getBuilding(ROUTE_ID)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects a duplicate route name", async () => {
    prismaMock.collectionRoute.findUnique.mockResolvedValueOnce(activeRoute);
    await expect(createRoute({ name: "Route A" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prismaMock.collectionRoute.create).not.toHaveBeenCalled();
  });
});

/* ---------- 3. Staff assignments ---------- */
describe("Staff assignments (subtask 1.4)", () => {
  it("assigns a Meter Reader to an active route and writes an audit entry", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(reader);
    prismaMock.collectionRoute.findUnique.mockResolvedValueOnce(activeRoute);
    prismaMock.userRouteAssignment.findUnique.mockResolvedValueOnce(null);
    prismaMock.userRouteAssignment.create.mockResolvedValueOnce({ id: ASSIGNMENT_ID });

    const result = await assignStaff({ userId: READER_ID, routeId: ROUTE_ID }, OPERATOR_ID);

    expect(result.id).toBe(ASSIGNMENT_ID);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "ASSIGNMENT_CREATED", userId: OPERATOR_ID }),
      }),
    );
  });

  it("rejects assigning a user who is not staff (invalid role)", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: SUBSCRIBER_ID,
      role: "SUBSCRIBER",
      isActive: true,
    });
    await expect(
      assignStaff({ userId: SUBSCRIBER_ID, routeId: ROUTE_ID }, OPERATOR_ID),
    ).rejects.toMatchObject({ code: "INVALID" });
  });

  it("rejects assigning staff to an inactive route", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(reader);
    prismaMock.collectionRoute.findUnique.mockResolvedValueOnce({ ...activeRoute, isActive: false });
    await expect(
      assignStaff({ userId: READER_ID, routeId: ROUTE_ID }, OPERATOR_ID),
    ).rejects.toMatchObject({ code: "INVALID" });
  });

  it("prevents duplicate active assignments", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(reader);
    prismaMock.collectionRoute.findUnique.mockResolvedValueOnce(activeRoute);
    prismaMock.userRouteAssignment.findUnique.mockResolvedValueOnce({
      id: ASSIGNMENT_ID,
      isActive: true,
    });
    await expect(
      assignStaff({ userId: READER_ID, routeId: ROUTE_ID }, OPERATOR_ID),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prismaMock.userRouteAssignment.create).not.toHaveBeenCalled();
  });

  it("reactivates an old inactive assignment instead of creating a duplicate", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(reader);
    prismaMock.collectionRoute.findUnique.mockResolvedValueOnce(activeRoute);
    prismaMock.userRouteAssignment.findUnique.mockResolvedValueOnce({
      id: ASSIGNMENT_ID,
      isActive: false,
    });
    prismaMock.userRouteAssignment.update.mockResolvedValueOnce({
      id: ASSIGNMENT_ID,
      isActive: true,
    });

    await assignStaff({ userId: READER_ID, routeId: ROUTE_ID }, OPERATOR_ID);

    expect(prismaMock.userRouteAssignment.create).not.toHaveBeenCalled();
    expect(prismaMock.userRouteAssignment.update).toHaveBeenCalledWith({
      where: { id: ASSIGNMENT_ID },
      data: { isActive: true },
    });
  });

  it("deactivates an assignment and records the old and new value", async () => {
    prismaMock.userRouteAssignment.findUnique.mockResolvedValueOnce({
      id: ASSIGNMENT_ID,
      isActive: true,
    });
    prismaMock.userRouteAssignment.update.mockResolvedValueOnce({
      id: ASSIGNMENT_ID,
      isActive: false,
    });

    await setAssignmentActive(ASSIGNMENT_ID, false, OPERATOR_ID);

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ASSIGNMENT_DEACTIVATED",
          oldValue: { isActive: true },
          newValue: { isActive: false },
        }),
      }),
    );
  });

  it("inactive assignments and inactive routes give no route access", async () => {
    prismaMock.userRouteAssignment.findMany.mockResolvedValueOnce([{ routeId: ROUTE_ID }]);

    const routeIds = await getActiveRouteIdsForUser(READER_ID);

    expect(routeIds).toEqual([ROUTE_ID]);
    expect(prismaMock.userRouteAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: READER_ID, isActive: true, route: { isActive: true } },
      }),
    );
  });
});

/* ---------- 4. API authorization ---------- */
describe("API authorization (subtask 1.3)", () => {
  const newBuildingRequest = () =>
    new Request("http://localhost/api/buildings", {
      method: "POST",
      body: JSON.stringify({ name: "Al-Nour", address: "Demo" }),
    });

  it("returns 401 when nobody is signed in", async () => {
    authMock.mockResolvedValueOnce(null);
    const response = await createBuildingApi(newBuildingRequest());
    expect(response.status).toBe(401);
    expect(prismaMock.building.create).not.toHaveBeenCalled();
  });

  it("returns 403 when a Meter Reader tries to create a building", async () => {
    authMock.mockResolvedValueOnce({ user: { id: READER_ID } });
    prismaMock.user.findUnique.mockResolvedValueOnce(reader);
    const response = await createBuildingApi(newBuildingRequest());
    expect(response.status).toBe(403);
    expect(prismaMock.building.create).not.toHaveBeenCalled();
  });

  it("returns 401 when the Operator's account was deactivated (fresh account check)", async () => {
    authMock.mockResolvedValueOnce({ user: { id: OPERATOR_ID } });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: OPERATOR_ID,
      role: "OPERATOR",
      isActive: false,
    });
    const response = await createBuildingApi(newBuildingRequest());
    expect(response.status).toBe(401);
  });

  it("returns 201 when an active Operator creates a building", async () => {
    authMock.mockResolvedValueOnce({ user: { id: OPERATOR_ID } });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: OPERATOR_ID,
      role: "OPERATOR",
      isActive: true,
    });
    prismaMock.building.create.mockResolvedValueOnce({ id: "b1", name: "Al-Nour" });
    const response = await createBuildingApi(newBuildingRequest());
    expect(response.status).toBe(201);
  });
});