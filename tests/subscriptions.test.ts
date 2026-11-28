import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { SubscriptionStatus } from "@/generated/prisma/enums";
import {
  createSubscriptionSchema,
  listSubscriptionsQuerySchema,
  subscriptionAmperageSchema,
  subscriptionDateSchema,
  subscriptionIdParamSchema,
  updateSubscriptionSchema,
} from "@/lib/validators/subscription.schema";
import type { SessionUser } from "@/server/auth/guards";
import {
  createSubscription,
  getSubscriptionById,
  listSubscriptions,
  MAX_ACTIVE_SUBSCRIPTIONS_PER_SUBSCRIBER,
  SubscriptionConflictError,
  SubscriptionNotFoundError,
  SubscriptionValidationError,
  updateSubscription,
  type CreateSubscriptionRecordInput,
  type SubscriptionRepository,
  type SubscriptionWithContext,
  type UpdateSubscriptionRecordInput,
} from "@/server/services/subscription.service";

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    subscriber: {
      findUnique: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  GET as getSubscriptionsHandler,
  POST as postSubscriptionHandler,
} from "@/app/api/subscriptions/route";
import {
  GET as getSubscriptionByIdHandler,
  PATCH as patchSubscriptionHandler,
} from "@/app/api/subscriptions/[id]/route";

const IDS = {
  operator: "00000000-0000-4000-8000-000000000001",
  reader: "00000000-0000-4000-8000-000000000002",
  collector: "00000000-0000-4000-8000-000000000003",
  subscriberUser: "00000000-0000-4000-8000-000000000004",
  building: "10000000-0000-4000-8000-000000000001",
  routeA: "20000000-0000-4000-8000-000000000001",
  subscriber1: "30000000-0000-4000-8000-000000000001",
  subscription1: "40000000-0000-4000-8000-000000000001",
  subscription2: "40000000-0000-4000-8000-000000000002",
};

const USERS: Record<"operator" | "reader" | "collector" | "subscriber", SessionUser> = {
  operator: { id: IDS.operator, role: "OPERATOR", fullName: "Demo Operator" },
  reader: { id: IDS.reader, role: "METER_READER", fullName: "Demo Reader" },
  collector: { id: IDS.collector, role: "PAYMENT_COLLECTOR", fullName: "Demo Collector" },
  subscriber: { id: IDS.subscriberUser, role: "SUBSCRIBER", fullName: "Subscriber S1" },
};

function makeSubscriptionWithContext(
  overrides: Partial<SubscriptionWithContext> = {},
): SubscriptionWithContext {
  return {
    id: IDS.subscription1,
    subscriberId: IDS.subscriber1,
    amperage: new Prisma.Decimal("10.00"),
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: null,
    status: SubscriptionStatus.ACTIVE,
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
    subscriber: overrides.subscriber ?? {
      id: IDS.subscriber1,
      fullName: "Subscriber S1",
      phoneNumber: "+96170000001",
      address: "Unit 1, Building Al-Nour",
      isActive: true,
      buildingId: IDS.building,
      routeId: IDS.routeA,
      building: { id: IDS.building, name: "Building Al-Nour" },
      route: { id: IDS.routeA, name: "Route A" },
    },
  };
}

function createMockRepository(
  overrides: Partial<SubscriptionRepository> = {},
): SubscriptionRepository {
  const repository: SubscriptionRepository = {
    withSubscriberLock: vi.fn(async (_subscriberId, work) => work(repository)),
    withSubscriptionLock: vi.fn(async (_subscriptionId, work) => work(repository)),
    findSubscriberById: vi.fn(async () => ({ id: IDS.subscriber1, isActive: true })),
    findActiveSubscriptionForSubscriber: vi.fn(async () => null),
    findSubscriptions: vi.fn(async () => [makeSubscriptionWithContext()]),
    findSubscriptionById: vi.fn(async () => makeSubscriptionWithContext()),
    createSubscription: vi.fn(async (data: CreateSubscriptionRecordInput) =>
      makeSubscriptionWithContext({
        subscriberId: data.subscriberId,
        amperage: data.amperage,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status,
      }),
    ),
    updateSubscription: vi.fn(async (id: string, data: UpdateSubscriptionRecordInput) =>
      makeSubscriptionWithContext({
        id,
        ...(data.amperage !== undefined ? { amperage: data.amperage } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      }),
    ),
    ...overrides,
  };
  return repository;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(
    async (work: (tx: typeof mockPrisma) => Promise<unknown>) => work(mockPrisma),
  );
});

describe("Subscription input validation (subscription.schema.ts)", () => {
  it("accepts valid creation payloads, defaults status to ACTIVE, and normalizes dates", () => {
    const numericResult = createSubscriptionSchema.safeParse({
      subscriberId: IDS.subscriber1,
      amperage: 10,
      startDate: "2026-02-15",
    });

    expect(numericResult.success).toBe(true);
    if (numericResult.success) {
      expect(numericResult.data.amperage.toString()).toBe("10");
      expect(numericResult.data.startDate.toISOString()).toBe("2026-02-15T00:00:00.000Z");
      expect(numericResult.data.status).toBe(SubscriptionStatus.ACTIVE);
    }

    const decimalResult = createSubscriptionSchema.safeParse({
      subscriberId: IDS.subscriber1,
      amperage: "15.50",
      startDate: "2026-03-01",
      endDate: "2026-12-31",
      status: "INACTIVE",
    });

    expect(decimalResult.success).toBe(true);
    if (decimalResult.success) {
      expect(decimalResult.data.amperage.toString()).toBe("15.5");
      expect(decimalResult.data.endDate?.toISOString()).toBe("2026-12-31T00:00:00.000Z");
      expect(decimalResult.data.status).toBe(SubscriptionStatus.INACTIVE);
    }
  });

  it("rejects zero, negative, out-of-precision amperages, invalid dates, and bad ranges", () => {
    for (const invalidAmperage of [null, "", "   ", 0, "0.00", -5, "-10", "12.345", "10000", "abc"]) {
      expect(subscriptionAmperageSchema.safeParse(invalidAmperage).success).toBe(false);
    }

    for (const invalidDate of ["", "2026-02-30", "2026-13-01", "2026/01/01"]) {
      expect(subscriptionDateSchema.safeParse(invalidDate).success).toBe(false);
    }

    const badRange = createSubscriptionSchema.safeParse({
      subscriberId: IDS.subscriber1,
      amperage: 10,
      startDate: "2026-05-10",
      endDate: "2026-05-09",
    });
    expect(badRange.success).toBe(false);

    expect(
      createSubscriptionSchema.safeParse({
        subscriberId: "not-a-uuid",
        amperage: 10,
        startDate: "2026-05-01",
      }).success,
    ).toBe(false);

    expect(
      createSubscriptionSchema.safeParse({
        subscriberId: IDS.subscriber1,
        amperage: 10,
        startDate: "2026-05-01",
        extraField: true,
      }).success,
    ).toBe(false);
  });

  it("validates partial updates, endDate clearing with null, and rejects empty or invalid PATCH payloads", () => {
    expect(updateSubscriptionSchema.safeParse({}).success).toBe(false);

    expect(
      updateSubscriptionSchema.safeParse({
        subscriberId: IDS.subscriber1,
        amperage: 15,
      }).success,
    ).toBe(false);

    const clearEndDate = updateSubscriptionSchema.safeParse({ endDate: null });
    expect(clearEndDate.success).toBe(true);
    if (clearEndDate.success) {
      expect(clearEndDate.data.endDate).toBeNull();
    }

    const badBothDates = updateSubscriptionSchema.safeParse({
      startDate: "2026-06-15",
      endDate: "2026-06-01",
    });
    expect(badBothDates.success).toBe(false);

    expect(listSubscriptionsQuerySchema.safeParse({ routeId: IDS.routeA, status: "ACTIVE" }).success).toBe(true);
    expect(subscriptionIdParamSchema.safeParse({ id: "bad-uuid" }).success).toBe(false);
  });
});

describe("Subscription business service (subscription.service.ts)", () => {
  it("lists and retrieves subscriptions for Operator and enforces setup:manage RBAC", async () => {
    const repository = createMockRepository();

    const list = await listSubscriptions(
      USERS.operator,
      { subscriberId: IDS.subscriber1, routeId: IDS.routeA, status: "ACTIVE" },
      { repository },
    );
    expect(list).toHaveLength(1);
    expect(repository.findSubscriptions).toHaveBeenCalledWith({
      subscriberId: IDS.subscriber1,
      routeId: IDS.routeA,
      status: SubscriptionStatus.ACTIVE,
    });

    const single = await getSubscriptionById(USERS.operator, IDS.subscription1, { repository });
    expect(single.id).toBe(IDS.subscription1);

    const missingRepo = createMockRepository({
      findSubscriptionById: vi.fn(async () => null),
    });
    await expect(
      getSubscriptionById(USERS.operator, IDS.subscription1, { repository: missingRepo }),
    ).rejects.toThrow(SubscriptionNotFoundError);

    await expect(listSubscriptions(null, {}, { repository })).rejects.toMatchObject({ status: 401 });
    for (const nonOperator of [USERS.reader, USERS.collector, USERS.subscriber]) {
      await expect(listSubscriptions(nonOperator, {}, { repository })).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        getSubscriptionById(nonOperator, IDS.subscription1, { repository }),
      ).rejects.toMatchObject({ status: 403 });
    }
  });

  it("creates an ACTIVE subscription and enforces subscriber eligibility and single-active rule", async () => {
    expect(MAX_ACTIVE_SUBSCRIPTIONS_PER_SUBSCRIBER).toBe(1);

    const repository = createMockRepository();
    const created = await createSubscription(
      USERS.operator,
      { subscriberId: IDS.subscriber1, amperage: 15, startDate: "2026-11-01" },
      { repository },
    );
    expect(created.amperage.toString()).toBe("15");
    expect(created.status).toBe(SubscriptionStatus.ACTIVE);
    expect(created.endDate).toBeNull();

    const missingSubRepo = createMockRepository({
      findSubscriberById: vi.fn(async () => null),
    });
    await expect(
      createSubscription(
        USERS.operator,
        { subscriberId: IDS.subscriber1, amperage: 10, startDate: "2026-11-01" },
        { repository: missingSubRepo },
      ),
    ).rejects.toThrow(SubscriptionNotFoundError);

    const inactiveSubRepo = createMockRepository({
      findSubscriberById: vi.fn(async () => ({ id: IDS.subscriber1, isActive: false })),
    });
    await expect(
      createSubscription(
        USERS.operator,
        { subscriberId: IDS.subscriber1, amperage: 10, startDate: "2026-11-01", status: "ACTIVE" },
        { repository: inactiveSubRepo },
      ),
    ).rejects.toThrow(SubscriptionValidationError);

    // Historical ended record is allowed even when another active subscription exists.
    const endedCreated = await createSubscription(
      USERS.operator,
      {
        subscriberId: IDS.subscriber1,
        amperage: 5,
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        status: "ENDED",
      },
      {
        repository: createMockRepository({
          findActiveSubscriptionForSubscriber: vi.fn(async () => ({ id: IDS.subscription2 })),
        }),
      },
    );
    expect(endedCreated.status).toBe(SubscriptionStatus.ENDED);

    const conflictRepo = createMockRepository({
      findActiveSubscriptionForSubscriber: vi.fn(async () => ({ id: IDS.subscription2 })),
    });
    const conflictErr = await createSubscription(
      USERS.operator,
      { subscriberId: IDS.subscriber1, amperage: 10, startDate: "2026-11-01" },
      { repository: conflictRepo },
    ).catch((err: unknown) => err);
    expect(conflictErr).toBeInstanceOf(SubscriptionConflictError);
    expect((conflictErr as SubscriptionConflictError).reason).toBe("DUPLICATE_ACTIVE_SUBSCRIPTION");
  });

  it("updates amperage, dates, and status while enforcing cross-date bounds and single-active conflict", async () => {
    const repository = createMockRepository();

    const updated = await updateSubscription(
      USERS.operator,
      IDS.subscription1,
      { amperage: "20.00", status: "ENDED", endDate: "2026-11-30" },
      { repository },
    );
    expect(updated.amperage.toString()).toBe("20");
    expect(updated.status).toBe(SubscriptionStatus.ENDED);
    expect(updated.endDate?.toISOString()).toBe("2026-11-30T00:00:00.000Z");

    // Partial update supplying only endDate earlier than existing DB startDate (2026-01-01).
    await expect(
      updateSubscription(
        USERS.operator,
        IDS.subscription1,
        { endDate: "2025-12-31" },
        { repository },
      ),
    ).rejects.toThrow(SubscriptionValidationError);

    // Partial update supplying only startDate later than existing DB endDate.
    const endedRepo = createMockRepository({
      findSubscriptionById: vi.fn(async () =>
        makeSubscriptionWithContext({
          status: SubscriptionStatus.INACTIVE,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: new Date("2026-06-30T00:00:00.000Z"),
        }),
      ),
    });
    await expect(
      updateSubscription(
        USERS.operator,
        IDS.subscription1,
        { startDate: "2026-07-01" },
        { repository: endedRepo },
      ),
    ).rejects.toThrow(SubscriptionValidationError);

    // Reactivating when another ACTIVE subscription exists triggers conflict.
    const conflictActivateRepo = createMockRepository({
      findSubscriptionById: vi.fn(async () =>
        makeSubscriptionWithContext({ status: SubscriptionStatus.INACTIVE }),
      ),
      findActiveSubscriptionForSubscriber: vi.fn(async () => ({ id: IDS.subscription2 })),
    });
    await expect(
      updateSubscription(
        USERS.operator,
        IDS.subscription1,
        { status: "ACTIVE" },
        { repository: conflictActivateRepo },
      ),
    ).rejects.toThrow(SubscriptionConflictError);

    // Reactivating for an inactive subscriber is rejected.
    const inactiveOwnerRepo = createMockRepository({
      findSubscriptionById: vi.fn(async () =>
        makeSubscriptionWithContext({
          status: SubscriptionStatus.INACTIVE,
          subscriber: {
            id: IDS.subscriber1,
            fullName: "Subscriber S1",
            phoneNumber: "+96170000001",
            address: "Unit 1",
            isActive: false,
            buildingId: IDS.building,
            routeId: IDS.routeA,
            building: { id: IDS.building, name: "Building Al-Nour" },
            route: { id: IDS.routeA, name: "Route A" },
          },
        }),
      ),
    });
    await expect(
      updateSubscription(
        USERS.operator,
        IDS.subscription1,
        { status: "ACTIVE" },
        { repository: inactiveOwnerRepo },
      ),
    ).rejects.toThrow(SubscriptionValidationError);
  });
});

describe("Subscription API route handlers (/api/subscriptions)", () => {
  it("POST /api/subscriptions handles 201, 400, 401, 403, 404, and 409 responses", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const unauthRes = await postSubscriptionHandler(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(unauthRes.status).toBe(401);

    mockAuth.mockResolvedValueOnce({ user: USERS.reader });
    const forbiddenRes = await postSubscriptionHandler(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(forbiddenRes.status).toBe(403);

    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    const badJsonRes = await postSubscriptionHandler(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        body: "{not-json",
      }),
    );
    expect(badJsonRes.status).toBe(400);

    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    const badAmperageRes = await postSubscriptionHandler(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriberId: IDS.subscriber1,
          amperage: 0,
          startDate: "2026-11-01",
        }),
      }),
    );
    expect(badAmperageRes.status).toBe(400);

    // Missing subscriber row lock -> 404
    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);
    const notFoundRes = await postSubscriptionHandler(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriberId: IDS.subscriber1,
          amperage: 10,
          startDate: "2026-11-01",
        }),
      }),
    );
    expect(notFoundRes.status).toBe(404);

    // Duplicate ACTIVE subscription -> 409
    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: IDS.subscriber1 }]);
    mockPrisma.subscriber.findUnique.mockResolvedValueOnce({
      id: IDS.subscriber1,
      isActive: true,
    });
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({ id: IDS.subscription2 });
    const conflictRes = await postSubscriptionHandler(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriberId: IDS.subscriber1,
          amperage: 10,
          startDate: "2026-11-01",
        }),
      }),
    );
    expect(conflictRes.status).toBe(409);
    const conflictJson = (await conflictRes.json()) as {
      success: boolean;
      error: { code: string; reason: string };
    };
    expect(conflictJson.success).toBe(false);
    expect(conflictJson.error.code).toBe("SUBSCRIPTION_CONFLICT");
    expect(conflictJson.error.reason).toBe("DUPLICATE_ACTIVE_SUBSCRIPTION");

    // Success -> 201
    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: IDS.subscriber1 }]);
    mockPrisma.subscriber.findUnique.mockResolvedValueOnce({
      id: IDS.subscriber1,
      isActive: true,
    });
    mockPrisma.subscription.findFirst.mockResolvedValueOnce(null);
    mockPrisma.subscription.create.mockResolvedValueOnce(
      makeSubscriptionWithContext({ amperage: new Prisma.Decimal("15.00") }),
    );
    const createdRes = await postSubscriptionHandler(
      new Request("http://localhost/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriberId: IDS.subscriber1,
          amperage: "15.00",
          startDate: "2026-11-01",
        }),
      }),
    );
    expect(createdRes.status).toBe(201);
    const createdJson = (await createdRes.json()) as {
      success: boolean;
      data: { id: string; amperage: string };
    };
    expect(createdJson.success).toBe(true);
    expect(createdJson.data.id).toBe(IDS.subscription1);
    expect(createdJson.data.amperage).toBe("15");
  });

  it("GET /api/subscriptions handles 200, 400, 401, and 403 responses", async () => {
    mockAuth.mockResolvedValueOnce(null);
    expect(
      (await getSubscriptionsHandler(new Request("http://localhost/api/subscriptions"))).status,
    ).toBe(401);

    mockAuth.mockResolvedValueOnce({ user: USERS.collector });
    expect(
      (await getSubscriptionsHandler(new Request("http://localhost/api/subscriptions"))).status,
    ).toBe(403);

    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    expect(
      (
        await getSubscriptionsHandler(
          new Request("http://localhost/api/subscriptions?status=ACTIVE&status=ENDED"),
        )
      ).status,
    ).toBe(400);

    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    mockPrisma.subscription.findMany.mockResolvedValueOnce([makeSubscriptionWithContext()]);
    const okRes = await getSubscriptionsHandler(
      new Request(`http://localhost/api/subscriptions?subscriberId=${IDS.subscriber1}`),
    );
    expect(okRes.status).toBe(200);
    const okJson = (await okRes.json()) as { success: boolean; data: Array<{ id: string }> };
    expect(okJson.success).toBe(true);
    expect(okJson.data).toHaveLength(1);
    expect(okJson.data[0]?.id).toBe(IDS.subscription1);
  });

  it("GET and PATCH /api/subscriptions/[id] handle 200, 400, 403, 404, and 409 responses", async () => {
    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    const badIdRes = await getSubscriptionByIdHandler(
      new Request("http://localhost/api/subscriptions/invalid-id"),
      { params: Promise.resolve({ id: "invalid-id" }) },
    );
    expect(badIdRes.status).toBe(400);

    mockAuth.mockResolvedValueOnce({ user: USERS.subscriber });
    const forbiddenGetRes = await getSubscriptionByIdHandler(
      new Request(`http://localhost/api/subscriptions/${IDS.subscription1}`),
      { params: Promise.resolve({ id: IDS.subscription1 }) },
    );
    expect(forbiddenGetRes.status).toBe(403);

    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
    const missingGetRes = await getSubscriptionByIdHandler(
      new Request(`http://localhost/api/subscriptions/${IDS.subscription1}`),
      { params: Promise.resolve({ id: IDS.subscription1 }) },
    );
    expect(missingGetRes.status).toBe(404);

    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(makeSubscriptionWithContext());
    const okGetRes = await getSubscriptionByIdHandler(
      new Request(`http://localhost/api/subscriptions/${IDS.subscription1}`),
      { params: Promise.resolve({ id: IDS.subscription1 }) },
    );
    expect(okGetRes.status).toBe(200);

    // PATCH empty body -> 400
    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    const emptyPatchRes = await patchSubscriptionHandler(
      new Request(`http://localhost/api/subscriptions/${IDS.subscription1}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: IDS.subscription1 }) },
    );
    expect(emptyPatchRes.status).toBe(400);

    // PATCH cross-date violation against existing startDate -> 400
    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    mockPrisma.subscription.findUnique
      .mockResolvedValueOnce({ id: IDS.subscription1, subscriberId: IDS.subscriber1 })
      .mockResolvedValueOnce(makeSubscriptionWithContext());
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ id: IDS.subscriber1 }])
      .mockResolvedValueOnce([{ id: IDS.subscription1 }]);

    const badDatePatchRes = await patchSubscriptionHandler(
      new Request(`http://localhost/api/subscriptions/${IDS.subscription1}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endDate: "2025-12-01" }),
      }),
      { params: Promise.resolve({ id: IDS.subscription1 }) },
    );
    expect(badDatePatchRes.status).toBe(400);

    // PATCH reactivation conflict -> 409
    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    mockPrisma.subscription.findUnique
      .mockResolvedValueOnce({ id: IDS.subscription1, subscriberId: IDS.subscriber1 })
      .mockResolvedValueOnce(
        makeSubscriptionWithContext({ status: SubscriptionStatus.INACTIVE }),
      );
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ id: IDS.subscriber1 }])
      .mockResolvedValueOnce([{ id: IDS.subscription1 }]);
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({ id: IDS.subscription2 });

    const conflictPatchRes = await patchSubscriptionHandler(
      new Request(`http://localhost/api/subscriptions/${IDS.subscription1}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      }),
      { params: Promise.resolve({ id: IDS.subscription1 }) },
    );
    expect(conflictPatchRes.status).toBe(409);

    // PATCH success -> 200
    mockAuth.mockResolvedValueOnce({ user: USERS.operator });
    mockPrisma.subscription.findUnique
      .mockResolvedValueOnce({ id: IDS.subscription1, subscriberId: IDS.subscriber1 })
      .mockResolvedValueOnce(makeSubscriptionWithContext());
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ id: IDS.subscriber1 }])
      .mockResolvedValueOnce([{ id: IDS.subscription1 }]);
    mockPrisma.subscription.update.mockResolvedValueOnce(
      makeSubscriptionWithContext({
        status: SubscriptionStatus.ENDED,
        endDate: new Date("2026-11-30T00:00:00.000Z"),
      }),
    );

    const okPatchRes = await patchSubscriptionHandler(
      new Request(`http://localhost/api/subscriptions/${IDS.subscription1}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ENDED", endDate: "2026-11-30" }),
      }),
      { params: Promise.resolve({ id: IDS.subscription1 }) },
    );
    expect(okPatchRes.status).toBe(200);
    const okPatchJson = (await okPatchRes.json()) as {
      success: boolean;
      data: { status: string };
    };
    expect(okPatchJson.success).toBe(true);
    expect(okPatchJson.data.status).toBe(SubscriptionStatus.ENDED);
  });
});
