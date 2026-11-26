import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { createTariffSchema, updateTariffSchema } from "@/lib/validators/tariff.schema";
import { activateTariff, createTariff, deactivateTariff, getTariffById, listTariffs, TariffConflictError, updateTariff } from "@/server/services/tariff.service";

const db = vi.hoisted(() => ({
  tariff: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  bill: { count: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const operator = { id: "operator-id", role: "OPERATOR" as const, fullName: "Operator" };
const reader = { id: "reader-id", role: "METER_READER" as const, fullName: "Reader" };
const input = { name: "5A", billingMonth: "2026-11-01", amperage: "5.00", ratePerKwh: "0.4500", fixedFee: "10.00", currency: "USD" };
const stored = { id: "tariff-id", ...input, billingMonth: new Date("2026-11-01T00:00:00Z"), amperage: new Prisma.Decimal("5"), ratePerKwh: new Prisma.Decimal("0.45"), fixedFee: new Prisma.Decimal("10"), isActive: true };

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (callback) => callback(db));
  db.$queryRaw.mockResolvedValue([{ id: stored.id }]);
  db.tariff.findUniqueOrThrow.mockResolvedValue(stored);
  db.bill.count.mockResolvedValue(0);
  db.tariff.update.mockResolvedValue(stored);
});

describe("tariff validation", () => {
  it("retains precision and canonicalizes the billing month", () => {
    const parsed = createTariffSchema.parse({ ...input, billingMonth: "2026-11-25", ratePerKwh: "0.4501" });
    expect(parsed.ratePerKwh.toString()).toBe("0.4501");
    expect(parsed.billingMonth.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(parsed.amperage).toBeInstanceOf(Prisma.Decimal);
  });
  it.each([
    { amperage: "0" }, { amperage: "-1" }, { ratePerKwh: "-0.01" }, { fixedFee: "-1" },
    { currency: "LBP" }, { ratePerKwh: "0.12345" }, { fixedFee: "1.001" }, { amperage: 5 },
    { billingMonth: "2026-02-30" }, { createdByUserId: "attacker" },
  ])("rejects invalid input %o", (invalid) => {
    expect(createTariffSchema.safeParse({ ...input, ...invalid }).success).toBe(false);
  });
  it("rejects unknown update fields", () => {
    expect(updateTariffSchema.safeParse({ createdByUserId: "attacker" }).success).toBe(false);
  });
});

describe("tariff service", () => {
  it("creates a tariff using the session user and Decimal values", async () => {
    db.tariff.create.mockResolvedValue(stored);
    await expect(createTariff(operator, input)).resolves.toEqual(stored);
    expect(db.tariff.create).toHaveBeenCalledWith({ data: expect.objectContaining({ createdByUserId: operator.id, ratePerKwh: new Prisma.Decimal("0.45") }) });
  });
  it("reports uniqueness conflicts without overwriting a tariff", async () => {
    db.tariff.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test", meta: { target: ["billingMonth", "amperage"] } }));
    await expect(createTariff(operator, input)).rejects.toThrow(TariffConflictError);
    expect(db.tariff.update).not.toHaveBeenCalled();
  });
  it("lists with optional filters and retrieves by ID", async () => {
    db.tariff.findMany.mockResolvedValue([stored]);
    db.tariff.findUnique.mockResolvedValue(stored);
    await expect(listTariffs(operator, { billingMonth: "2026-11-20", isActive: false })).resolves.toEqual([stored]);
    expect(db.tariff.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { billingMonth: stored.billingMonth, isActive: false } }));
    await expect(getTariffById(operator, stored.id)).resolves.toEqual(stored);
    db.tariff.findUnique.mockResolvedValue(null);
    await expect(getTariffById(operator, stored.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("updates an unused tariff after locking it", async () => {
    await updateTariff(operator, stored.id, { ratePerKwh: "0.5000" });
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.tariff.update).toHaveBeenCalledWith({ where: { id: stored.id }, data: { ratePerKwh: new Prisma.Decimal("0.5") } });
  });
  it.each([{ ratePerKwh: "0.6" }, { fixedFee: "20" }, { amperage: "10" }, { billingMonth: "2026-12-01" }])("blocks historical changes %o when billed", async (changes) => {
    db.bill.count.mockResolvedValue(1);
    await expect(updateTariff(operator, stored.id, changes)).rejects.toMatchObject({ reason: "HISTORICAL_PRICING" });
    expect(db.tariff.update).not.toHaveBeenCalled();
  });
  it("allows a name change or unchanged pricing for a billed tariff", async () => {
    db.bill.count.mockResolvedValue(1);
    await expect(updateTariff(operator, stored.id, { name: "New name", ratePerKwh: "0.4500" })).resolves.toEqual(stored);
  });
  it("deactivates without deleting", async () => {
    db.tariff.updateMany.mockResolvedValue({ count: 1 });
    await deactivateTariff(operator, stored.id);
    expect(db.tariff.updateMany).toHaveBeenCalledWith({ where: { id: stored.id }, data: { isActive: false } });
  });
  it("activates without changing prices or deleting history", async () => {
    db.tariff.updateMany.mockResolvedValue({ count: 1 });
    await expect(activateTariff(operator, stored.id)).resolves.toEqual(stored);
    expect(db.tariff.updateMany).toHaveBeenCalledWith({ where: { id: stored.id }, data: { isActive: true } });
    db.tariff.updateMany.mockResolvedValue({ count: 0 });
    await expect(activateTariff(operator, stored.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("rejects unauthorized and unauthenticated access before querying", async () => {
    const operations = [
      (user: typeof reader | null) => createTariff(user, input),
      (user: typeof reader | null) => listTariffs(user),
      (user: typeof reader | null) => getTariffById(user, stored.id),
      (user: typeof reader | null) => updateTariff(user, stored.id, input),
      (user: typeof reader | null) => deactivateTariff(user, stored.id),
      (user: typeof reader | null) => activateTariff(user, stored.id),
    ];
    for (const operation of operations) {
      await expect(operation(reader)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(operation(null)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    }
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.tariff.create).not.toHaveBeenCalled();
    expect(db.tariff.findMany).not.toHaveBeenCalled();
    expect(db.tariff.findUnique).not.toHaveBeenCalled();
    expect(db.tariff.updateMany).not.toHaveBeenCalled();
  });
});
