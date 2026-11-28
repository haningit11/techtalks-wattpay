import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type MeterReading } from "@/generated/prisma/client";
import { ReadingStatus } from "@/generated/prisma/enums";
import { type SessionUser } from "@/server/auth/guards";
import {
  resolveFlaggedReading, type ReadingReviewRepository, type ReadingReviewTransaction,
} from "@/server/services/reading-review.service";

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    $transaction: vi.fn(), $queryRaw: vi.fn(),
    meterReading: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    bill: { findUnique: vi.fn() }, auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
import { PATCH } from "@/app/api/readings/[id]/review/route";

const id = "50000000-0000-4000-8000-000000000001";
const subscriptionId = "40000000-0000-4000-8000-000000000001";
const operator: SessionUser = { id: "00000000-0000-4000-8000-000000000001", role: "OPERATOR", fullName: "Operator" };
const input = { approvedValue: "1200.125", reviewNote: "  Meter checked  " };

function reading(overrides: Partial<MeterReading> = {}): MeterReading {
  return {
    id, subscriptionId, billingMonth: new Date("2026-11-01T00:00:00Z"),
    previousReadingValue: new Prisma.Decimal("1000"), submittedValue: new Prisma.Decimal("900"),
    approvedValue: null, consumptionKwh: null, status: ReadingStatus.FLAGGED,
    flagReason: "Lower than previous", submittedByUserId: "00000000-0000-4000-8000-000000000002",
    reviewedByUserId: null, reviewedAt: null, reviewNote: null,
    createdAt: new Date("2026-11-01T00:00:00Z"), updatedAt: new Date("2026-11-01T00:00:00Z"),
    ...overrides,
  };
}

// In-memory transactional fake: serializes work and commits only on success. This is not a PostgreSQL lock test.
function fakeRepository(options: { later?: boolean; bill?: boolean; failAudit?: boolean; count?: number; initial?: MeterReading } = {}) {
  let state = options.initial ?? reading();
  let audits: Parameters<ReadingReviewTransaction["createAudit"]>[0][] = [];
  let queue: Promise<void> = Promise.resolve();
  const repository: ReadingReviewRepository = {
    findReading: async () => ({ ...state }),
    withSubscriptionLock: async (_subscription, work) => {
      let release!: () => void;
      const previous = queue;
      queue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      let working = { ...state };
      const pending: typeof audits = [];
      const tx: ReadingReviewTransaction = {
        lockReading: async () => {},
        findReading: async () => ({ ...working }),
        findLaterReading: async () => options.later ? { id } : null,
        findBill: async () => options.bill ? { id } : null,
        updateFlaggedReading: async (_id, data) => {
          if (options.count !== undefined) return options.count;
          if (working.status !== ReadingStatus.FLAGGED) return 0;
          working = { ...working, ...data };
          return 1;
        },
        createAudit: async (audit) => { if (options.failAudit) throw new Error("audit failed"); pending.push(audit); },
      };
      try {
        const result = await work(tx);
        state = working;
        audits = [...audits, ...pending];
        return result;
      } finally { release(); }
    },
  };
  return { repository, state: () => state, audits: () => audits };
}

describe("flagged reading review", () => {
  it("preserves the submission and flag, calculates consumption, records reviewer, note and audit snapshots", async () => {
    const fake = fakeRepository();
    const result = await resolveFlaggedReading(operator, id, input, fake);
    expect(result).toMatchObject({ status: "RESOLVED", submittedValue: new Prisma.Decimal("900"),
      approvedValue: new Prisma.Decimal("1200.125"), consumptionKwh: new Prisma.Decimal("200.125"),
      flagReason: "Lower than previous", reviewedByUserId: operator.id, reviewNote: "Meter checked" });
    expect(result.reviewedAt).toBeInstanceOf(Date);
    expect(fake.audits()).toHaveLength(1);
    expect(fake.audits()[0]).toMatchObject({ action: "READING_RESOLVED", entityType: "MeterReading", entityId: id, userId: operator.id,
      oldValue: { status: "FLAGGED", submittedValue: "900", approvedValue: null, consumptionKwh: null, reviewedAt: null },
      newValue: { status: "RESOLVED", submittedValue: "900", approvedValue: "1200.125", consumptionKwh: "200.125", reviewNote: "Meter checked", reviewedByUserId: operator.id, reviewedAt: result.reviewedAt!.toISOString() } });
  });
  it("allows zero consumption", async () => {
    const fake = fakeRepository();
    const result = await resolveFlaggedReading(operator, id, { ...input, approvedValue: "1000" }, fake);
    expect(result.consumptionKwh?.toString()).toBe("0");
  });
  it("rejects a lower approved value", async () => {
    await expect(resolveFlaggedReading(operator, id, { ...input, approvedValue: "999" }, fakeRepository())).rejects.toMatchObject({ reason: "APPROVED_BELOW_PREVIOUS" });
  });
  it.each([undefined, "", "   "])('requires a nonblank note: %s', async (reviewNote) => {
    await expect(resolveFlaggedReading(operator, id, { approvedValue: "1200", reviewNote }, fakeRepository())).rejects.toThrow();
  });
  it("rejects unknown fields, invalid IDs, and invalid precision", async () => {
    for (const [readingId, body] of [[id, { ...input, reviewedByUserId: operator.id }], ["bad", input], [id, { ...input, approvedValue: "1.0001" }]] as const) {
      await expect(resolveFlaggedReading(operator, readingId, body, fakeRepository())).rejects.toThrow();
    }
  });
  it.each(["BASELINE", "ACCEPTED", "RESOLVED"] as const)("rejects %s", async (status) => {
    await expect(resolveFlaggedReading(operator, id, input, fakeRepository({ initial: reading({ status }) }))).rejects.toMatchObject({ reason: "NOT_FLAGGED" });
  });
  it.each([
    [{ later: true }, "LATER_READING"], [{ bill: true }, "EXISTING_BILL"],
    [{ initial: reading({ previousReadingValue: null }) }, "MISSING_PREVIOUS_VALUE"], [{ count: 0 }, "CONCURRENT_RESOLUTION"],
  ] as const)("rejects historical and concurrent conflicts", async (options, reason) => {
    await expect(resolveFlaggedReading(operator, id, input, fakeRepository(options))).rejects.toMatchObject({ reason });
  });
  it("rejects missing records and unauthorized users", async () => {
    const fake = fakeRepository();
    fake.repository.findReading = async () => null;
    await expect(resolveFlaggedReading(operator, id, input, fake)).rejects.toMatchObject({ name: "ReadingReviewNotFoundError" });
    await expect(resolveFlaggedReading(null, id, input, fake)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    for (const role of ["METER_READER", "PAYMENT_COLLECTOR", "SUBSCRIBER"] as const) {
      await expect(resolveFlaggedReading({ ...operator, role }, id, input, fake)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
  it("rolls back the fake transaction when audit insertion fails", async () => {
    const fake = fakeRepository({ failAudit: true });
    await expect(resolveFlaggedReading(operator, id, input, fake)).rejects.toThrow("audit failed");
    expect(fake.state().status).toBe("FLAGGED");
    expect(fake.audits()).toHaveLength(0);
  });
  it("serializes competing reviews in the fake and rejects a repeated review", async () => {
    const fake = fakeRepository();
    const results = await Promise.allSettled([resolveFlaggedReading(operator, id, input, fake), resolveFlaggedReading(operator, id, input, fake)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(fake.audits()).toHaveLength(1);
    await expect(resolveFlaggedReading(operator, id, input, fake)).rejects.toMatchObject({ reason: "NOT_FLAGGED" });
  });
});

describe("PATCH review API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.mockResolvedValue({ user: operator });
    mockPrisma.$transaction.mockImplementation(async (work) => work(mockPrisma));
    mockPrisma.$queryRaw.mockResolvedValue([{ id: subscriptionId }]);
    mockPrisma.meterReading.findUnique.mockResolvedValue(reading());
    mockPrisma.meterReading.findFirst.mockResolvedValue(null);
    mockPrisma.bill.findUnique.mockResolvedValue(null);
    mockPrisma.meterReading.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.auditLog.create.mockResolvedValue({});
  });
  function request(body: unknown = input) {
    return PATCH(new Request("http://localhost/api/readings/id/review", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
  }
  it("returns a successful envelope and uses a read committed transaction", async () => {
    const updated = reading({ status: ReadingStatus.RESOLVED, approvedValue: new Prisma.Decimal("1200.125"), consumptionKwh: new Prisma.Decimal("200.125"), reviewedByUserId: operator.id, reviewedAt: new Date("2026-11-26T12:00:00Z"), reviewNote: "Meter checked" });
    mockPrisma.meterReading.findUnique.mockResolvedValueOnce(reading()).mockResolvedValueOnce(reading()).mockResolvedValueOnce(updated);
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { id, status: "RESOLVED", approvedValue: "1200.125", submittedValue: "900", reviewedByUserId: operator.id } });
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
  });
  it("returns 401 and 403 for unauthorized users", async () => {
    mockAuth.mockResolvedValueOnce(null).mockResolvedValueOnce({ user: { ...operator, role: "METER_READER" } });
    expect((await request()).status).toBe(401);
    expect((await request()).status).toBe(403);
  });
  it("returns 400 for invalid input and lower approved values", async () => {
    const invalidNote = await request({ ...input, reviewNote: " " });
    expect(invalidNote.status).toBe(400);
    expect((await invalidNote.json()).error.reason).toBe("INVALID_REVIEW_NOTE");
    const response = await request({ ...input, approvedValue: "999" });
    expect(response.status).toBe(400);
    expect((await response.json()).error.reason).toBe("APPROVED_BELOW_PREVIOUS");
  });
  it("returns 404 for a missing reading and 409 for a conflict", async () => {
    mockPrisma.meterReading.findUnique.mockResolvedValueOnce(null);
    expect((await request()).status).toBe(404);
    mockPrisma.meterReading.findUnique.mockResolvedValue(reading({ status: ReadingStatus.RESOLVED }));
    const response = await request();
    expect(response.status).toBe(409);
    expect((await response.json()).error.reason).toBe("NOT_FLAGGED");
  });
  it("hides unexpected errors", async () => {
    mockPrisma.meterReading.findUnique.mockRejectedValue(new Error("database secret"));
    const response = await request();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("database secret");
  });
});
