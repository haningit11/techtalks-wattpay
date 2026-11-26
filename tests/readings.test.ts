import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type MeterReading } from "@/generated/prisma/client";
import { ReadingStatus, SubscriptionStatus } from "@/generated/prisma/enums";
import { AuthError, type SessionUser } from "@/server/auth/guards";
import {
  getMeterReadingById,
  getReaderWorkspaceData,
  listMeterReadings,
  READING_FLAG_REASONS,
  ReadingConflictError,
  ReadingNotFoundError,
  ReadingValidationError,
  submitMeterReading,
  type CreateMeterReadingRecordInput,
  type MeterReadingWithContext,
  type ReaderRouteAssignmentWithSubscribers,
  type ReadingRepository,
} from "@/server/services/reading.service";

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    subscription: {
      findUnique: vi.fn(),
    },
    userRouteAssignment: {
      findMany: vi.fn(),
    },
    meterReading: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET as getReadingsHandler, POST as postReadingHandler } from "@/app/api/readings/route";
import { GET as getReadingByIdHandler } from "@/app/api/readings/[id]/route";

const IDS = {
  operator: "00000000-0000-4000-8000-000000000001",
  reader: "00000000-0000-4000-8000-000000000002",
  collector: "00000000-0000-4000-8000-000000000003",
  subscriberUser: "00000000-0000-4000-8000-000000000004",
  otherSubscriberUser: "00000000-0000-4000-8000-000000000005",
  building: "10000000-0000-4000-8000-000000000001",
  routeA: "20000000-0000-4000-8000-000000000001",
  routeB: "20000000-0000-4000-8000-000000000002",
  subscriber1: "30000000-0000-4000-8000-000000000001",
  subscription1: "40000000-0000-4000-8000-000000000001",
  reading1: "50000000-0000-4000-8000-000000000001",
};

const USERS: Record<"operator" | "reader" | "collector" | "subscriber" | "otherSubscriber", SessionUser> = {
  operator: { id: IDS.operator, role: "OPERATOR", fullName: "Demo Operator" },
  reader: { id: IDS.reader, role: "METER_READER", fullName: "Demo Reader" },
  collector: { id: IDS.collector, role: "PAYMENT_COLLECTOR", fullName: "Demo Collector" },
  subscriber: { id: IDS.subscriberUser, role: "SUBSCRIBER", fullName: "Subscriber S1" },
  otherSubscriber: { id: IDS.otherSubscriberUser, role: "SUBSCRIBER", fullName: "Subscriber S2" },
};

function makeReadingRecord(overrides: Partial<MeterReading> = {}): MeterReading {
  return {
    id: IDS.reading1,
    subscriptionId: IDS.subscription1,
    billingMonth: new Date("2026-11-01T00:00:00.000Z"),
    previousReadingValue: new Prisma.Decimal("1200"),
    submittedValue: new Prisma.Decimal("1350"),
    approvedValue: null,
    consumptionKwh: new Prisma.Decimal("150"),
    status: ReadingStatus.ACCEPTED,
    flagReason: null,
    submittedByUserId: IDS.reader,
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: new Date("2026-11-24T10:00:00.000Z"),
    updatedAt: new Date("2026-11-24T10:00:00.000Z"),
    ...overrides,
  };
}

function makeReadingWithContext(
  overrides: Partial<MeterReadingWithContext> = {},
): MeterReadingWithContext {
  const base = makeReadingRecord(overrides);
  return {
    ...base,
    subscription: overrides.subscription ?? {
      id: IDS.subscription1,
      amperage: new Prisma.Decimal("10"),
      status: SubscriptionStatus.ACTIVE,
      subscriber: {
        id: IDS.subscriber1,
        fullName: "Ahmad Hassan",
        address: "Floor 2",
        routeId: IDS.routeA,
        userId: IDS.subscriberUser,
        building: { id: IDS.building, name: "Building Al-Nour" },
        route: { id: IDS.routeA, name: "Route A" },
      },
    },
  };
}

function createMockRepository(overrides: Partial<ReadingRepository> = {}): ReadingRepository {
  return {
    findSubscriptionWithRoute: vi.fn(async () => ({
      id: IDS.subscription1,
      status: SubscriptionStatus.ACTIVE,
      subscriber: {
        id: IDS.subscriber1,
        isActive: true,
        routeId: IDS.routeA,
        route: { id: IDS.routeA, isActive: true },
      },
    })),
    findActiveAssignedRouteIds: vi.fn(async () => [IDS.routeA]),
    findReadingForMonth: vi.fn(async () => null),
    findLatestPriorReading: vi.fn(async () => ({
      id: "50000000-0000-4000-8000-000000000000",
      billingMonth: new Date("2026-10-01T00:00:00.000Z"),
      status: ReadingStatus.BASELINE,
      submittedValue: new Prisma.Decimal("1200"),
      approvedValue: new Prisma.Decimal("1200"),
      consumptionKwh: null,
    })),
    createMeterReading: vi.fn(async (data: CreateMeterReadingRecordInput) =>
      makeReadingRecord({
        subscriptionId: data.subscriptionId,
        billingMonth: data.billingMonth,
        previousReadingValue: data.previousReadingValue,
        submittedValue: data.submittedValue,
        approvedValue: data.approvedValue,
        consumptionKwh: data.consumptionKwh,
        status: data.status,
        flagReason: data.flagReason,
        submittedByUserId: data.submittedByUserId,
      }),
    ),
    findReadings: vi.fn(async () => [makeReadingWithContext()]),
    findReadingById: vi.fn(async () => makeReadingWithContext()),
    findReaderRoutesWithActiveSubscriptions: vi.fn(async () => []),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Meter reading submission service (SCRUM-77 / SCRUM-82)", () => {
  it("submits an accepted monthly reading, retrieves prior baseline, and computes consumption", async () => {
    const repository = createMockRepository();

    const result = await submitMeterReading(
      USERS.reader,
      {
        subscriptionId: IDS.subscription1,
        billingMonth: "2026-11",
        submittedValue: 1350,
      },
      { repository },
    );

    expect(result.status).toBe(ReadingStatus.ACCEPTED);
    expect(result.previousReadingValue?.toString()).toBe("1200");
    expect(result.submittedValue.toString()).toBe("1350");
    expect(result.approvedValue).toBeNull();
    expect(result.consumptionKwh?.toString()).toBe("150");
    expect(result.flagReason).toBeNull();
    expect(result.submittedByUserId).toBe(IDS.reader);
    expect(repository.createMeterReading).toHaveBeenCalledTimes(1);
  });

  it("preserves lower submittedValue as FLAGGED with null consumptionKwh", async () => {
    const repository = createMockRepository({
      findLatestPriorReading: vi.fn(async () => ({
        id: "50000000-0000-4000-8000-000000000000",
        billingMonth: new Date("2026-10-01T00:00:00.000Z"),
        status: ReadingStatus.BASELINE,
        submittedValue: new Prisma.Decimal("900"),
        approvedValue: new Prisma.Decimal("900"),
        consumptionKwh: null,
      })),
    });

    const result = await submitMeterReading(
      USERS.reader,
      {
        subscriptionId: IDS.subscription1,
        billingMonth: "2026-11",
        submittedValue: "850",
      },
      { repository },
    );

    expect(result.status).toBe(ReadingStatus.FLAGGED);
    expect(result.submittedValue.toString()).toBe("850");
    expect(result.approvedValue).toBeNull();
    expect(result.consumptionKwh).toBeNull();
    expect(result.flagReason).toBe(READING_FLAG_REASONS.LOWER_THAN_PREVIOUS);
  });

  it("uses approvedValue from a RESOLVED prior reading when calculating next month consumption", async () => {
    const repository = createMockRepository({
      findLatestPriorReading: vi.fn(async () => ({
        id: "50000000-0000-4000-8000-000000000010",
        billingMonth: new Date("2026-10-01T00:00:00.000Z"),
        status: ReadingStatus.RESOLVED,
        submittedValue: new Prisma.Decimal("850"),
        approvedValue: new Prisma.Decimal("950"),
        consumptionKwh: new Prisma.Decimal("50"),
      })),
    });

    const result = await submitMeterReading(
      USERS.reader,
      {
        subscriptionId: IDS.subscription1,
        billingMonth: "2026-11",
        submittedValue: 1050,
      },
      { repository },
    );

    expect(result.previousReadingValue?.toString()).toBe("950");
    expect(result.consumptionKwh?.toString()).toBe("100");
    expect(result.status).toBe(ReadingStatus.ACCEPTED);
  });

  it("prevents duplicate monthly submissions via upfront check and Prisma P2002 fallback", async () => {
    const upfrontRepo = createMockRepository({
      findReadingForMonth: vi.fn(async () => ({ id: IDS.reading1 })),
    });

    const upfrontError = await submitMeterReading(
      USERS.reader,
      { subscriptionId: IDS.subscription1, billingMonth: "2026-11", submittedValue: 1350 },
      { repository: upfrontRepo },
    ).catch((err: unknown) => err);

    expect(upfrontError).toBeInstanceOf(ReadingConflictError);
    expect((upfrontError as ReadingConflictError).reason).toBe("DUPLICATE_MONTH");
    expect(upfrontRepo.createMeterReading).not.toHaveBeenCalled();

    const p2002Repo = createMockRepository({
      createMeterReading: vi.fn(async () => {
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "7.10.1",
        });
      }),
    });

    const raceError = await submitMeterReading(
      USERS.reader,
      { subscriptionId: IDS.subscription1, billingMonth: "2026-11", submittedValue: 1350 },
      { repository: p2002Repo },
    ).catch((err: unknown) => err);

    expect(raceError).toBeInstanceOf(ReadingConflictError);
    expect((raceError as ReadingConflictError).reason).toBe("DUPLICATE_MONTH");
  });

  it("blocks submission when prior reading is missing or still FLAGGED", async () => {
    const noPriorRepo = createMockRepository({
      findLatestPriorReading: vi.fn(async () => null),
    });

    await expect(
      submitMeterReading(
        USERS.reader,
        { subscriptionId: IDS.subscription1, billingMonth: "2026-11", submittedValue: 1350 },
        { repository: noPriorRepo },
      ),
    ).rejects.toThrow(ReadingValidationError);

    const flaggedPriorRepo = createMockRepository({
      findLatestPriorReading: vi.fn(async () => ({
        id: IDS.reading1,
        billingMonth: new Date("2026-10-01T00:00:00.000Z"),
        status: ReadingStatus.FLAGGED,
        submittedValue: new Prisma.Decimal("850"),
        approvedValue: null,
        consumptionKwh: null,
      })),
    });

    const flaggedError = await submitMeterReading(
      USERS.reader,
      { subscriptionId: IDS.subscription1, billingMonth: "2026-11", submittedValue: 1350 },
      { repository: flaggedPriorRepo },
    ).catch((err: unknown) => err);

    expect(flaggedError).toBeInstanceOf(ReadingConflictError);
    expect((flaggedError as ReadingConflictError).reason).toBe("UNRESOLVED_PRIOR_READING");
  });

  it("rejects missing, inactive, or ended subscriptions, subscribers, and routes", async () => {
    const missingSubRepo = createMockRepository({
      findSubscriptionWithRoute: vi.fn(async () => null),
    });
    await expect(
      submitMeterReading(
        USERS.reader,
        { subscriptionId: IDS.subscription1, billingMonth: "2026-11", submittedValue: 1350 },
        { repository: missingSubRepo },
      ),
    ).rejects.toThrow(ReadingNotFoundError);

    const inactiveSubRepo = createMockRepository({
      findSubscriptionWithRoute: vi.fn(async () => ({
        id: IDS.subscription1,
        status: SubscriptionStatus.INACTIVE,
        subscriber: {
          id: IDS.subscriber1,
          isActive: true,
          routeId: IDS.routeA,
          route: { id: IDS.routeA, isActive: true },
        },
      })),
    });
    await expect(
      submitMeterReading(
        USERS.reader,
        { subscriptionId: IDS.subscription1, billingMonth: "2026-11", submittedValue: 1350 },
        { repository: inactiveSubRepo },
      ),
    ).rejects.toThrow(ReadingValidationError);

    const inactiveRouteRepo = createMockRepository({
      findSubscriptionWithRoute: vi.fn(async () => ({
        id: IDS.subscription1,
        status: SubscriptionStatus.ACTIVE,
        subscriber: {
          id: IDS.subscriber1,
          isActive: true,
          routeId: IDS.routeA,
          route: { id: IDS.routeA, isActive: false },
        },
      })),
    });
    await expect(
      submitMeterReading(
        USERS.reader,
        { subscriptionId: IDS.subscription1, billingMonth: "2026-11", submittedValue: 1350 },
        { repository: inactiveRouteRepo },
      ),
    ).rejects.toThrow(ReadingValidationError);
  });

  it("rejects unauthenticated users, unauthorized roles, and unassigned route submissions", async () => {
    const repository = createMockRepository();

    await expect(
      submitMeterReading(
        null,
        { subscriptionId: IDS.subscription1, billingMonth: "2026-11", submittedValue: 1350 },
        { repository },
      ),
    ).rejects.toMatchObject({ status: 401 });

    for (const nonReader of [USERS.operator, USERS.collector, USERS.subscriber]) {
      await expect(
        submitMeterReading(
          nonReader,
          { subscriptionId: IDS.subscription1, billingMonth: "2026-11", submittedValue: 1350 },
          { repository },
        ),
      ).rejects.toMatchObject({ status: 403 });
    }

    const unassignedRouteRepo = createMockRepository({
      findActiveAssignedRouteIds: vi.fn(async () => [IDS.routeB]),
    });
    await expect(
      submitMeterReading(
        USERS.reader,
        { subscriptionId: IDS.subscription1, billingMonth: "2026-11", submittedValue: 1350 },
        { repository: unassignedRouteRepo },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("Reading history and workspace retrieval (SCRUM-79 / SCRUM-82)", () => {
  it("scopes listMeterReadings by role and rejects unassigned route or subscription filters", async () => {
    const repository = createMockRepository();

    await listMeterReadings(
      USERS.operator,
      { routeId: IDS.routeB, billingMonth: "2026-11", status: "FLAGGED" },
      { repository },
    );
    expect(repository.findReadings).toHaveBeenLastCalledWith({
      subscriptionId: undefined,
      billingMonth: new Date("2026-11-01T00:00:00.000Z"),
      status: ReadingStatus.FLAGGED,
      routeIds: [IDS.routeB],
    });

    await listMeterReadings(USERS.reader, { subscriptionId: IDS.subscription1 }, { repository });
    expect(repository.findReadings).toHaveBeenLastCalledWith({
      subscriptionId: IDS.subscription1,
      billingMonth: undefined,
      status: undefined,
      routeIds: [IDS.routeA],
    });

    await expect(
      listMeterReadings(USERS.reader, { routeId: IDS.routeB }, { repository }),
    ).rejects.toMatchObject({ status: 403 });

    const unassignedSubRepo = createMockRepository({
      findSubscriptionWithRoute: vi.fn(async () => ({
        id: IDS.subscription1,
        status: SubscriptionStatus.ACTIVE,
        subscriber: {
          id: IDS.subscriber1,
          isActive: true,
          routeId: IDS.routeB,
          route: { id: IDS.routeB, isActive: true },
        },
      })),
    });
    await expect(
      listMeterReadings(
        USERS.reader,
        { subscriptionId: IDS.subscription1 },
        { repository: unassignedSubRepo },
      ),
    ).rejects.toMatchObject({ status: 403 });

    const noRoutesRepo = createMockRepository({
      findActiveAssignedRouteIds: vi.fn(async () => []),
    });
    const emptyResult = await listMeterReadings(USERS.reader, {}, { repository: noRoutesRepo });
    expect(emptyResult).toEqual([]);
    expect(noRoutesRepo.findReadings).not.toHaveBeenCalled();

    await listMeterReadings(USERS.subscriber, {}, { repository });
    expect(repository.findReadings).toHaveBeenLastCalledWith({
      subscriptionId: undefined,
      billingMonth: undefined,
      status: undefined,
      routeIds: undefined,
      ownerUserId: IDS.subscriberUser,
    });

    await expect(listMeterReadings(USERS.collector, {}, { repository })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("enforces record access in getMeterReadingById (403 unassigned route, 404 other subscriber)", async () => {
    const repository = createMockRepository();

    const operatorView = await getMeterReadingById(USERS.operator, IDS.reading1, { repository });
    expect(operatorView.id).toBe(IDS.reading1);

    const readerView = await getMeterReadingById(USERS.reader, IDS.reading1, { repository });
    expect(readerView.id).toBe(IDS.reading1);

    const ownerView = await getMeterReadingById(USERS.subscriber, IDS.reading1, { repository });
    expect(ownerView.id).toBe(IDS.reading1);

    const unassignedRepo = createMockRepository({
      findActiveAssignedRouteIds: vi.fn(async () => [IDS.routeB]),
    });
    await expect(
      getMeterReadingById(USERS.reader, IDS.reading1, { repository: unassignedRepo }),
    ).rejects.toMatchObject({ status: 403 });

    const otherSubErr = await getMeterReadingById(USERS.otherSubscriber, IDS.reading1, {
      repository,
    }).catch((err: unknown) => err);
    expect(otherSubErr).toBeInstanceOf(AuthError);
    expect((otherSubErr as AuthError).status).toBe(404);

    const missingRepo = createMockRepository({
      findReadingById: vi.fn(async () => null),
    });
    await expect(
      getMeterReadingById(USERS.operator, IDS.reading1, { repository: missingRepo }),
    ).rejects.toThrow(ReadingNotFoundError);
  });

  it("builds serialized ReaderWorkspaceData with effective values and thresholds", async () => {
    const assignments: ReaderRouteAssignmentWithSubscribers[] = [
      {
        route: {
          id: IDS.routeA,
          name: "Route A",
          description: "Building Al-Nour",
          subscribers: [
            {
              id: IDS.subscriber1,
              fullName: "Ahmad Hassan",
              address: "Floor 2",
              building: { id: IDS.building, name: "Building Al-Nour" },
              subscriptions: [
                {
                  id: IDS.subscription1,
                  amperage: new Prisma.Decimal("15"),
                  status: SubscriptionStatus.ACTIVE,
                  meterReadings: [
                    {
                      id: IDS.reading1,
                      billingMonth: new Date("2026-10-01T00:00:00.000Z"),
                      previousReadingValue: new Prisma.Decimal("800"),
                      submittedValue: new Prisma.Decimal("850"),
                      approvedValue: new Prisma.Decimal("950"),
                      consumptionKwh: new Prisma.Decimal("150"),
                      status: ReadingStatus.RESOLVED,
                      flagReason: READING_FLAG_REASONS.LOWER_THAN_PREVIOUS,
                      reviewNote: "Verified counter rollover",
                      createdAt: new Date("2026-10-30T12:00:00.000Z"),
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ];

    const repository = createMockRepository({
      findReaderRoutesWithActiveSubscriptions: vi.fn(async () => assignments),
    });

    const workspace = await getReaderWorkspaceData(USERS.reader, { repository });

    expect(workspace.routes).toEqual([
      { id: IDS.routeA, name: "Route A", description: "Building Al-Nour" },
    ]);
    expect(workspace.subscribers).toHaveLength(1);
    expect(workspace.subscribers[0]).toMatchObject({
      subscriptionId: IDS.subscription1,
      amperage: 15,
      latestEffectiveReading: "950",
      latestBillingMonth: "2026-10",
      latestConsumptionKwh: "150",
      hasUnresolvedFlaggedReading: false,
      highThresholdKwh: "450",
    });
    expect(workspace.subscribers[0]?.history[0]).toMatchObject({
      id: IDS.reading1,
      billingMonth: "2026-10",
      submittedValue: "850",
      approvedValue: "950",
      status: ReadingStatus.RESOLVED,
    });
  });
});

describe("Meter reading API route handlers (SCRUM-80 / SCRUM-82)", () => {
  it("POST /api/readings returns 201, 400, 401, 403, and 409 responses accurately", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const unauthRes = await postReadingHandler(
      new Request("http://localhost/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(unauthRes.status).toBe(401);

    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    const forbiddenRes = await postReadingHandler(
      new Request("http://localhost/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(forbiddenRes.status).toBe(403);

    mockAuth.mockResolvedValueOnce({ user: USERS.reader });
    const badJsonRes = await postReadingHandler(
      new Request("http://localhost/api/readings", {
        method: "POST",
        body: "{bad-json",
      }),
    );
    expect(badJsonRes.status).toBe(400);

    mockAuth.mockResolvedValueOnce({ user: USERS.reader });
    const negativeRes = await postReadingHandler(
      new Request("http://localhost/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: IDS.subscription1,
          billingMonth: "2026-11",
          submittedValue: -5,
        }),
      }),
    );
    expect(negativeRes.status).toBe(400);

    mockAuth.mockResolvedValueOnce({ user: USERS.reader });
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      id: IDS.subscription1,
      status: SubscriptionStatus.ACTIVE,
      subscriber: {
        id: IDS.subscriber1,
        isActive: true,
        routeId: IDS.routeA,
        route: { id: IDS.routeA, isActive: true },
      },
    });
    mockPrisma.userRouteAssignment.findMany.mockResolvedValueOnce([{ routeId: IDS.routeA }]);
    mockPrisma.meterReading.findUnique.mockResolvedValueOnce(null);
    mockPrisma.meterReading.findFirst.mockResolvedValueOnce({
      id: "50000000-0000-4000-8000-000000000000",
      billingMonth: new Date("2026-10-01T00:00:00.000Z"),
      status: ReadingStatus.BASELINE,
      submittedValue: new Prisma.Decimal("1200"),
      approvedValue: new Prisma.Decimal("1200"),
      consumptionKwh: null,
    });
    mockPrisma.meterReading.create.mockResolvedValueOnce(makeReadingRecord());

    const createdRes = await postReadingHandler(
      new Request("http://localhost/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: IDS.subscription1,
          billingMonth: "2026-11",
          submittedValue: 1350,
        }),
      }),
    );
    expect(createdRes.status).toBe(201);
    const createdJson = (await createdRes.json()) as {
      success: boolean;
      data: { status: string; consumptionKwh: string };
    };
    expect(createdJson.success).toBe(true);
    expect(createdJson.data.status).toBe(ReadingStatus.ACCEPTED);
    expect(createdJson.data.consumptionKwh).toBe("150");

    mockAuth.mockResolvedValueOnce({ user: USERS.reader });
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      id: IDS.subscription1,
      status: SubscriptionStatus.ACTIVE,
      subscriber: {
        id: IDS.subscriber1,
        isActive: true,
        routeId: IDS.routeA,
        route: { id: IDS.routeA, isActive: true },
      },
    });
    mockPrisma.userRouteAssignment.findMany.mockResolvedValueOnce([{ routeId: IDS.routeA }]);
    mockPrisma.meterReading.findUnique.mockResolvedValueOnce({ id: IDS.reading1 });

    const duplicateRes = await postReadingHandler(
      new Request("http://localhost/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: IDS.subscription1,
          billingMonth: "2026-11",
          submittedValue: 1350,
        }),
      }),
    );
    expect(duplicateRes.status).toBe(409);
    const duplicateJson = (await duplicateRes.json()) as {
      success: boolean;
      error: { code: string; reason: string };
    };
    expect(duplicateJson.success).toBe(false);
    expect(duplicateJson.error.code).toBe("READING_CONFLICT");
    expect(duplicateJson.error.reason).toBe("DUPLICATE_MONTH");
  });

  it("GET /api/readings returns 200 for scoped history and 400/401/403 on bad or unauthorized requests", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const unauthRes = await getReadingsHandler(new Request("http://localhost/api/readings"));
    expect(unauthRes.status).toBe(401);

    mockAuth.mockResolvedValueOnce({ user: USERS.reader });
    const duplicateQueryRes = await getReadingsHandler(
      new Request("http://localhost/api/readings?status=ACCEPTED&status=FLAGGED"),
    );
    expect(duplicateQueryRes.status).toBe(400);

    mockAuth.mockResolvedValueOnce({ user: USERS.reader });
    mockPrisma.userRouteAssignment.findMany.mockResolvedValueOnce([{ routeId: IDS.routeA }]);
    const unassignedRes = await getReadingsHandler(
      new Request(`http://localhost/api/readings?routeId=${IDS.routeB}`),
    );
    expect(unassignedRes.status).toBe(403);

    mockAuth.mockResolvedValueOnce({ user: USERS.reader });
    mockPrisma.userRouteAssignment.findMany.mockResolvedValueOnce([{ routeId: IDS.routeA }]);
    mockPrisma.meterReading.findMany.mockResolvedValueOnce([makeReadingWithContext()]);

    const okRes = await getReadingsHandler(
      new Request(`http://localhost/api/readings?billingMonth=2026-11`),
    );
    expect(okRes.status).toBe(200);
    const okJson = (await okRes.json()) as { success: boolean; data: Array<{ id: string }> };
    expect(okJson.success).toBe(true);
    expect(okJson.data).toHaveLength(1);
    expect(okJson.data[0]?.id).toBe(IDS.reading1);
  });

  it("GET /api/readings/[id] handles 200, 400, 403, and 404 ownership rules", async () => {
    mockAuth.mockResolvedValueOnce({ user: USERS.reader });
    const invalidIdRes = await getReadingByIdHandler(
      new Request("http://localhost/api/readings/bad-id"),
      { params: Promise.resolve({ id: "bad-id" }) },
    );
    expect(invalidIdRes.status).toBe(400);

    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    mockPrisma.meterReading.findUnique.mockResolvedValueOnce(null);
    const missingRes = await getReadingByIdHandler(
      new Request(`http://localhost/api/readings/${IDS.reading1}`),
      { params: Promise.resolve({ id: IDS.reading1 }) },
    );
    expect(missingRes.status).toBe(404);

    mockAuth.mockResolvedValueOnce({ user: USERS.otherSubscriber });
    mockPrisma.meterReading.findUnique.mockResolvedValueOnce(makeReadingWithContext());
    const otherSubRes = await getReadingByIdHandler(
      new Request(`http://localhost/api/readings/${IDS.reading1}`),
      { params: Promise.resolve({ id: IDS.reading1 }) },
    );
    expect(otherSubRes.status).toBe(404);

    mockAuth.mockResolvedValueOnce({ user: USERS.reader });
    mockPrisma.meterReading.findUnique.mockResolvedValueOnce(makeReadingWithContext());
    mockPrisma.userRouteAssignment.findMany.mockResolvedValueOnce([{ routeId: IDS.routeB }]);
    const wrongRouteRes = await getReadingByIdHandler(
      new Request(`http://localhost/api/readings/${IDS.reading1}`),
      { params: Promise.resolve({ id: IDS.reading1 }) },
    );
    expect(wrongRouteRes.status).toBe(403);

    mockAuth.mockResolvedValueOnce({ user: USERS.reader });
    mockPrisma.meterReading.findUnique.mockResolvedValueOnce(makeReadingWithContext());
    mockPrisma.userRouteAssignment.findMany.mockResolvedValueOnce([{ routeId: IDS.routeA }]);
    const okRes = await getReadingByIdHandler(
      new Request(`http://localhost/api/readings/${IDS.reading1}`),
      { params: Promise.resolve({ id: IDS.reading1 }) },
    );
    expect(okRes.status).toBe(200);
  });
});
