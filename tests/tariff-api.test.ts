import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AuthError } from "@/server/auth/guards";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  create: vi.fn(), list: vi.fn(), get: vi.fn(), update: vi.fn(), deactivate: vi.fn(), activate: vi.fn(),
  Conflict: class TariffConflictError extends Error { constructor(message: string, readonly reason = "DUPLICATE") { super(message); } },
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/services/tariff.service", () => ({
  createTariff: mocks.create, listTariffs: mocks.list, getTariffById: mocks.get,
  updateTariff: mocks.update, deactivateTariff: mocks.deactivate, activateTariff: mocks.activate, TariffConflictError: mocks.Conflict,
}));

import { GET as list, POST as create } from "@/app/api/tariffs/route";
import { GET as get, PATCH as patch } from "@/app/api/tariffs/[id]/route";

const id = "60000000-0000-4000-8000-000000000001";
const user = { id: "operator-id", role: "OPERATOR", fullName: "Operator" };
const input = { name: "5A", billingMonth: "2026-11-01", amperage: "5.00", ratePerKwh: "0.4500", fixedFee: "10.00", currency: "USD" };
const tariff = { id, ...input, ratePerKwh: new Prisma.Decimal("0.45"), isActive: true };
const context = (value = id) => ({ params: Promise.resolve({ id: value }) });
const request = (method: string, body?: unknown, url = "http://localhost/api/tariffs") => new Request(url, {
  method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user });
  mocks.create.mockResolvedValue(tariff);
  mocks.list.mockResolvedValue([tariff]);
  mocks.get.mockResolvedValue(tariff);
  mocks.update.mockResolvedValue(tariff);
  mocks.deactivate.mockResolvedValue({ ...tariff, isActive: false });
  mocks.activate.mockResolvedValue({ ...tariff, isActive: true });
});

describe("tariff API authorization", () => {
  it.each([null, { id: "reader", role: "METER_READER", fullName: "Reader" }, { id: "collector", role: "PAYMENT_COLLECTOR", fullName: "Collector" }, { id: "subscriber", role: "SUBSCRIBER", fullName: "Subscriber" }])("rejects all operations for %o before validation or service access", async (sessionUser) => {
    mocks.auth.mockResolvedValue(sessionUser ? { user: sessionUser } : null);
    const responses = await Promise.all([
      list(request("GET", undefined, "http://localhost/api/tariffs?invalid=1")),
      create(request("POST", {})), get(request("GET"), context("invalid")), patch(request("PATCH", {}), context("invalid")), patch(request("PATCH", { isActive: true }), context()),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(sessionUser ? 403 : 401);
      expect(await response.json()).toMatchObject({ success: false, error: { code: sessionUser ? "FORBIDDEN" : "UNAUTHENTICATED" } });
    }
    for (const method of [mocks.create, mocks.list, mocks.get, mocks.update, mocks.deactivate, mocks.activate]) expect(method).not.toHaveBeenCalled();
  });
});

describe("tariff collection API", () => {
  it("creates using the authenticated user and returns serialized data", async () => {
    const response = await create(request("POST", input));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, data: { id, ratePerKwh: "0.45" } });
    expect(mocks.create).toHaveBeenCalledWith(user, input);
  });
  it.each([{ ...input, createdByUserId: "other" }, { ...input, ratePerKwh: "-1" }, { ...input, currency: "LBP" }, null, []])("rejects invalid or untrusted creation input %o", async (body) => {
    expect((await create(request("POST", body))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON", async () => {
    const response = await create(new Request("http://localhost/api/tariffs", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
  });
  it("lists tariffs and parses optional filters", async () => {
    const response = await list(request("GET", undefined, "http://localhost/api/tariffs?billingMonth=2026-11-18&isActive=false"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: [{ id }] });
    expect(mocks.list).toHaveBeenCalledWith(user, { billingMonth: "2026-11-18", isActive: false });
    await list(request("GET"));
    expect(mocks.list).toHaveBeenLastCalledWith(user, {});
  });
  it.each(["isActive=1", "isActive=TRUE", "billingMonth=2026-02-30", "other=x", "__proto__=x", "isActive=true&isActive=false"])("rejects invalid query %s", async (query) => {
    expect((await list(request("GET", undefined, `http://localhost/api/tariffs?${query}`))).status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});

describe("individual tariff API", () => {
  it("retrieves an existing tariff", async () => {
    const response = await get(request("GET"), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { id } });
    expect(mocks.get).toHaveBeenCalledWith(user, id);
  });
  it("returns 404 for a missing tariff", async () => {
    mocks.get.mockRejectedValue(new AuthError("NOT_FOUND"));
    const response = await get(request("GET"), context());
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });
  it("rejects malformed IDs on both methods", async () => {
    expect((await get(request("GET"), context("bad"))).status).toBe(400);
    expect((await patch(request("PATCH", { name: "new" }), context("bad"))).status).toBe(400);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("updates an unused tariff with raw validated values", async () => {
    const body = { ratePerKwh: "0.5000" };
    const response = await patch(request("PATCH", body), context());
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(user, id, body);
  });
  it("deactivates only through the service", async () => {
    const response = await patch(request("PATCH", { isActive: false }), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { isActive: false } });
    expect(mocks.deactivate).toHaveBeenCalledWith(user, id);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("activates only through the service", async () => {
    const response = await patch(request("PATCH", { isActive: true }), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { isActive: true } });
    expect(mocks.activate).toHaveBeenCalledWith(user, id);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([{ isActive: "true" }, { isActive: false, name: "new" }, { isActive: true, name: "new" }, { createdByUserId: "other" }, { fixedFee: "-2" }, null])("rejects invalid patches %o", async (body) => {
    expect((await patch(request("PATCH", body), context())).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.deactivate).not.toHaveBeenCalled();
    expect(mocks.activate).not.toHaveBeenCalled();
  });
  it.each(["update", "deactivate", "activate"] as const)("returns 404 when %s cannot find the tariff", async (operation) => {
    mocks[operation].mockRejectedValue(new AuthError("NOT_FOUND"));
    const body = operation === "update" ? { name: "new" } : { isActive: operation === "activate" };
    expect((await patch(request("PATCH", body), context())).status).toBe(404);
  });
});

describe("tariff API errors", () => {
  it("returns conflict for service uniqueness or historical restrictions", async () => {
    mocks.create.mockRejectedValue(new mocks.Conflict("Duplicate tariff."));
    mocks.update.mockRejectedValue(new mocks.Conflict("Tariff already billed.", "HISTORICAL_PRICING"));
    const created = await create(request("POST", input));
    const updated = await patch(request("PATCH", { fixedFee: "20" }), context());
    expect(created.status).toBe(409);
    expect(updated.status).toBe(409);
    expect(await created.json()).toMatchObject({ error: { code: "TARIFF_CONFLICT", reason: "DUPLICATE" } });
    expect(await updated.json()).toMatchObject({ error: { code: "TARIFF_CONFLICT", reason: "HISTORICAL_PRICING" } });
  });
  it("does not expose unexpected errors or treat other database errors as conflicts", async () => {
    mocks.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("secret database details", { code: "P2003", clientVersion: "test" }));
    const response = await create(request("POST", input));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
  });
});
