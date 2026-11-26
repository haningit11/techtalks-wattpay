import { Prisma, type MeterReading } from "@/generated/prisma/client";
import { ReadingStatus, SubscriptionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  listReadingsQuerySchema,
  readingIdParamSchema,
  submitReadingSchema,
} from "@/lib/validators/reading.schema";
import {
  requireRecordAccess,
  requireRole,
  requireRouteAccess,
  requireUser,
  type SessionUser,
} from "@/server/auth/guards";

type User = SessionUser | null | undefined;

// Default anomaly rule: flag when consumption exceeds 3x the prior month's usage
// (PRD §7), or exceeds 500 kWh when the prior reading is a BASELINE without prior usage.
export const HIGH_CONSUMPTION_MULTIPLIER = 3;
export const BASELINE_HIGH_CONSUMPTION_THRESHOLD_KWH = new Prisma.Decimal("500");

export const READING_FLAG_REASONS = {
  LOWER_THAN_PREVIOUS: "Submitted reading is lower than the previous cumulative reading.",
  ZERO_CONSUMPTION: "Submitted reading equals the previous reading (zero consumption).",
  UNUSUALLY_HIGH: "Calculated consumption exceeds the configured high-consumption threshold.",
} as const;

export class ReadingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadingValidationError";
  }
}

export class ReadingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadingNotFoundError";
  }
}

export class ReadingConflictError extends Error {
  constructor(
    message: string,
    readonly reason: "DUPLICATE_MONTH" | "UNRESOLVED_PRIOR_READING" | "OUT_OF_ORDER_READING" = "DUPLICATE_MONTH",
  ) {
    super(message);
    this.name = "ReadingConflictError";
  }
}

export interface PriorReadingSnapshot {
  id: string;
  billingMonth: Date;
  status: ReadingStatus;
  submittedValue: Prisma.Decimal;
  approvedValue: Prisma.Decimal | null;
  consumptionKwh: Prisma.Decimal | null;
}

export interface SubscriptionWithRoute {
  id: string;
  status: SubscriptionStatus;
  subscriber: {
    id: string;
    isActive: boolean;
    routeId: string;
    route: {
      id: string;
      isActive: boolean;
    };
  };
}

export interface MeterReadingWithContext extends MeterReading {
  subscription: {
    id: string;
    amperage: Prisma.Decimal;
    status: SubscriptionStatus;
    subscriber: {
      id: string;
      fullName: string;
      address: string;
      routeId: string;
      userId: string | null;
      building: { id: string; name: string };
      route: { id: string; name: string };
    };
  };
}

export interface ReadingHistoryCriteria {
  subscriptionId?: string;
  billingMonth?: Date;
  status?: ReadingStatus;
  routeIds?: string[];
  ownerUserId?: string;
}

export interface ReaderRouteAssignmentWithSubscribers {
  route: {
    id: string;
    name: string;
    description: string | null;
    subscribers: Array<{
      id: string;
      fullName: string;
      address: string;
      building: { id: string; name: string };
      subscriptions: Array<{
        id: string;
        amperage: Prisma.Decimal;
        status: SubscriptionStatus;
        meterReadings: Array<{
          id: string;
          billingMonth: Date;
          previousReadingValue: Prisma.Decimal | null;
          submittedValue: Prisma.Decimal;
          approvedValue: Prisma.Decimal | null;
          consumptionKwh: Prisma.Decimal | null;
          status: ReadingStatus;
          flagReason: string | null;
          reviewNote: string | null;
          createdAt: Date;
        }>;
      }>;
    }>;
  };
}

export interface SerializedReadingHistoryItem {
  id: string;
  billingMonth: string;
  previousReadingValue: string | null;
  submittedValue: string;
  approvedValue: string | null;
  consumptionKwh: string | null;
  status: ReadingStatus;
  flagReason: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface ReaderRouteOption {
  id: string;
  name: string;
  description: string | null;
}

export interface ReaderSubscriberItem {
  subscriptionId: string;
  subscriberId: string;
  subscriberName: string;
  address: string;
  buildingName: string;
  routeId: string;
  routeName: string;
  amperage: number;
  latestEffectiveReading: string | null;
  latestBillingMonth: string | null;
  latestConsumptionKwh: string | null;
  hasUnresolvedFlaggedReading: boolean;
  highThresholdKwh: string;
  history: SerializedReadingHistoryItem[];
}

export interface ReaderWorkspaceData {
  routes: ReaderRouteOption[];
  subscribers: ReaderSubscriberItem[];
}

export interface CreateMeterReadingRecordInput {
  subscriptionId: string;
  billingMonth: Date;
  previousReadingValue: Prisma.Decimal;
  submittedValue: Prisma.Decimal;
  approvedValue: null;
  consumptionKwh: Prisma.Decimal | null;
  status: ReadingStatus;
  flagReason: string | null;
  submittedByUserId: string;
}

export interface ReadingRepository {
  withSubscriptionLock<T>(subscriptionId: string, work: (repository: ReadingRepository) => Promise<T>): Promise<T>;
  findLaterReading(subscriptionId: string, billingMonth: Date): Promise<{ id: string } | null>;
  findSubscriptionWithRoute(subscriptionId: string): Promise<SubscriptionWithRoute | null>;
  findActiveAssignedRouteIds(userId: string): Promise<string[]>;
  findReadingForMonth(subscriptionId: string, billingMonth: Date): Promise<{ id: string } | null>;
  findLatestPriorReading(
    subscriptionId: string,
    billingMonth: Date,
  ): Promise<PriorReadingSnapshot | null>;
  createMeterReading(data: CreateMeterReadingRecordInput): Promise<MeterReading>;
  findReadings(criteria: ReadingHistoryCriteria): Promise<MeterReadingWithContext[]>;
  findReadingById(id: string): Promise<MeterReadingWithContext | null>;
  findReaderRoutesWithActiveSubscriptions(
    userId: string,
  ): Promise<ReaderRouteAssignmentWithSubscribers[]>;
}

const READING_WITH_CONTEXT_INCLUDE = {
  subscription: {
    select: {
      id: true,
      amperage: true,
      status: true,
      subscriber: {
        select: {
          id: true,
          fullName: true,
          address: true,
          routeId: true,
          userId: true,
          building: { select: { id: true, name: true } },
          route: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

function makePrismaReadingRepository(client: Prisma.TransactionClient): ReadingRepository {
  return {
    withSubscriptionLock(subscriptionId, work) {
      return prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Subscription" WHERE "id" = ${subscriptionId}::uuid FOR UPDATE`;
        if (rows.length === 0) throw new ReadingNotFoundError("Subscription not found.");
        return work(makePrismaReadingRepository(tx));
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    },

    findLaterReading(subscriptionId, billingMonth) {
      return client.meterReading.findFirst({
        where: { subscriptionId, billingMonth: { gt: billingMonth } },
        select: { id: true },
      });
    },
    findSubscriptionWithRoute(subscriptionId) {
      return client.subscription.findUnique({
        where: { id: subscriptionId },
        select: {
          id: true,
          status: true,
          subscriber: {
            select: {
              id: true,
              isActive: true,
              routeId: true,
              route: {
                select: {
                  id: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });
    },

    async findActiveAssignedRouteIds(userId) {
      const assignments = await client.userRouteAssignment.findMany({
        where: {
          userId,
          isActive: true,
          route: { isActive: true },
        },
        select: { routeId: true },
      });
      return assignments.map((assignment) => assignment.routeId);
    },

    findReadingForMonth(subscriptionId, billingMonth) {
      return client.meterReading.findUnique({
        where: {
          subscriptionId_billingMonth: {
            subscriptionId,
            billingMonth,
          },
        },
        select: { id: true },
      });
    },

    findLatestPriorReading(subscriptionId, billingMonth) {
      return client.meterReading.findFirst({
        where: {
          subscriptionId,
          billingMonth: { lt: billingMonth },
        },
        orderBy: { billingMonth: "desc" },
        select: {
          id: true,
          billingMonth: true,
          status: true,
          submittedValue: true,
          approvedValue: true,
          consumptionKwh: true,
        },
      });
    },

    createMeterReading(data) {
      return client.meterReading.create({ data });
    },

    findReadings(criteria) {
      const subscriberFilter: Prisma.SubscriberWhereInput = {};
      if (criteria.routeIds !== undefined) {
        subscriberFilter.routeId = { in: criteria.routeIds };
      }
      if (criteria.ownerUserId !== undefined) {
        subscriberFilter.userId = criteria.ownerUserId;
      }

      const where: Prisma.MeterReadingWhereInput = {
        ...(criteria.subscriptionId !== undefined ? { subscriptionId: criteria.subscriptionId } : {}),
        ...(criteria.billingMonth !== undefined ? { billingMonth: criteria.billingMonth } : {}),
        ...(criteria.status !== undefined ? { status: criteria.status } : {}),
        ...(Object.keys(subscriberFilter).length > 0
          ? { subscription: { subscriber: subscriberFilter } }
          : {}),
      };

      return client.meterReading.findMany({
        where,
        include: READING_WITH_CONTEXT_INCLUDE,
        orderBy: [{ billingMonth: "desc" }, { createdAt: "desc" }],
      });
    },

    findReadingById(id) {
      return client.meterReading.findUnique({
        where: { id },
        include: READING_WITH_CONTEXT_INCLUDE,
      });
    },

    findReaderRoutesWithActiveSubscriptions(userId) {
      return client.userRouteAssignment.findMany({
        where: {
          userId,
          isActive: true,
          route: { isActive: true },
        },
        orderBy: { route: { name: "asc" } },
        select: {
          route: {
            select: {
              id: true,
              name: true,
              description: true,
              subscribers: {
                where: { isActive: true },
                orderBy: { fullName: "asc" },
                select: {
                  id: true,
                  fullName: true,
                  address: true,
                  building: { select: { id: true, name: true } },
                  subscriptions: {
                    where: { status: SubscriptionStatus.ACTIVE },
                    orderBy: { createdAt: "desc" },
                    select: {
                      id: true,
                      amperage: true,
                      status: true,
                      meterReadings: {
                        orderBy: { billingMonth: "desc" },
                        take: 12,
                        select: {
                          id: true,
                          billingMonth: true,
                          previousReadingValue: true,
                          submittedValue: true,
                          approvedValue: true,
                          consumptionKwh: true,
                          status: true,
                          flagReason: true,
                          reviewNote: true,
                          createdAt: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    },
  };
}

const prismaReadingRepository = makePrismaReadingRepository(prisma);

export interface EvaluateMeterReadingInput {
  submittedValue: Prisma.Decimal;
  previousReadingValue: Prisma.Decimal;
  previousConsumptionKwh?: Prisma.Decimal | null;
  highConsumptionThresholdKwh?: Prisma.Decimal;
}

export interface ReadingEvaluationResult {
  status: typeof ReadingStatus.ACCEPTED | typeof ReadingStatus.FLAGGED;
  consumptionKwh: Prisma.Decimal | null;
  flagReason: string | null;
  highThresholdKwh: Prisma.Decimal;
}

/**
 * Returns the cumulative meter value carried forward from a prior reading.
 * Resolved and baseline readings use their approved value when present.
 */
export function getEffectiveReadingValue(reading: {
  status: ReadingStatus;
  submittedValue: Prisma.Decimal;
  approvedValue: Prisma.Decimal | null;
}): Prisma.Decimal {
  if (
    (reading.status === ReadingStatus.RESOLVED || reading.status === ReadingStatus.BASELINE) &&
    reading.approvedValue !== null
  ) {
    return reading.approvedValue;
  }
  return reading.submittedValue;
}

function resolveHighConsumptionThreshold(
  previousConsumptionKwh?: Prisma.Decimal | null,
  overrideThresholdKwh?: Prisma.Decimal,
): Prisma.Decimal {
  if (overrideThresholdKwh !== undefined) {
    return overrideThresholdKwh;
  }

  if (previousConsumptionKwh && previousConsumptionKwh.gt(0)) {
    return previousConsumptionKwh.mul(HIGH_CONSUMPTION_MULTIPLIER);
  }

  return BASELINE_HIGH_CONSUMPTION_THRESHOLD_KWH;
}

/**
 * Evaluates a non-negative submitted reading against its previous cumulative reading
 * and returns the reading status, calculated kWh consumption, and flag reason.
 */
export function evaluateMeterReading(input: EvaluateMeterReadingInput): ReadingEvaluationResult {
  const highThresholdKwh = resolveHighConsumptionThreshold(
    input.previousConsumptionKwh,
    input.highConsumptionThresholdKwh,
  );

  // Lower readings store null consumption so PostgreSQL's CHECK (consumptionKwh >= 0) passes.
  if (input.submittedValue.lt(input.previousReadingValue)) {
    return {
      status: ReadingStatus.FLAGGED,
      consumptionKwh: null,
      flagReason: READING_FLAG_REASONS.LOWER_THAN_PREVIOUS,
      highThresholdKwh,
    };
  }

  if (input.submittedValue.eq(input.previousReadingValue)) {
    return {
      status: ReadingStatus.FLAGGED,
      consumptionKwh: new Prisma.Decimal("0"),
      flagReason: READING_FLAG_REASONS.ZERO_CONSUMPTION,
      highThresholdKwh,
    };
  }

  const delta = input.submittedValue.minus(input.previousReadingValue);
  if (delta.gt(highThresholdKwh)) {
    return {
      status: ReadingStatus.FLAGGED,
      consumptionKwh: delta,
      flagReason: READING_FLAG_REASONS.UNUSUALLY_HIGH,
      highThresholdKwh,
    };
  }

  return {
    status: ReadingStatus.ACCEPTED,
    consumptionKwh: delta,
    flagReason: null,
    highThresholdKwh,
  };
}

/**
 * Validates and persists a monthly cumulative meter reading for an authorized
 * Meter Reader on an active assigned route while preserving submittedValue.
 */
export async function submitMeterReading(
  user: User,
  input: unknown,
  deps: { repository?: ReadingRepository; highConsumptionThresholdKwh?: Prisma.Decimal } = {},
): Promise<MeterReading> {
  requireRole(user, "readings:submit");
  const reader = requireUser(user);
  const parsed = submitReadingSchema.parse(input);
  const repository = deps.repository ?? prismaReadingRepository;

  try {
    return await repository.withSubscriptionLock(parsed.subscriptionId, async (repository) => {
      const subscription = await repository.findSubscriptionWithRoute(parsed.subscriptionId);
      if (!subscription) {
        throw new ReadingNotFoundError("Subscription not found.");
      }

      const assignedRouteIds = await repository.findActiveAssignedRouteIds(reader.id);
      requireRouteAccess(subscription.subscriber.routeId, assignedRouteIds);

      if (!subscription.subscriber.route.isActive) {
        throw new ReadingValidationError("Readings cannot be submitted on an inactive collection route.");
      }

      if (!subscription.subscriber.isActive) {
        throw new ReadingValidationError("Readings cannot be submitted for an inactive subscriber.");
      }

      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        throw new ReadingValidationError("Readings can only be submitted for an active subscription.");
      }

      const existingReading = await repository.findReadingForMonth(
        parsed.subscriptionId,
        parsed.billingMonth,
      );
      if (existingReading) {
        throw new ReadingConflictError(
          "A meter reading already exists for this subscription and billing month.",
          "DUPLICATE_MONTH",
        );
      }

      const laterReading = await repository.findLaterReading(parsed.subscriptionId, parsed.billingMonth);
      if (laterReading) {
        throw new ReadingConflictError(
          "A later month's reading already exists for this subscription.",
          "OUT_OF_ORDER_READING",
        );
      }

      const priorReading = await repository.findLatestPriorReading(
        parsed.subscriptionId,
        parsed.billingMonth,
      );
      if (!priorReading) {
        throw new ReadingValidationError(
          "No previous cumulative reading exists for this subscription before the selected billing month.",
        );
      }

      if (priorReading.status === ReadingStatus.FLAGGED) {
        throw new ReadingConflictError(
          "The previous reading for this subscription is still flagged and must be reviewed before submitting a new month.",
          "UNRESOLVED_PRIOR_READING",
        );
      }

      const previousReadingValue = getEffectiveReadingValue(priorReading);
      const evaluation = evaluateMeterReading({
        submittedValue: parsed.submittedValue,
        previousReadingValue,
        previousConsumptionKwh: priorReading.consumptionKwh,
        highConsumptionThresholdKwh: deps.highConsumptionThresholdKwh,
      });

      return await repository.createMeterReading({
        subscriptionId: parsed.subscriptionId,
        billingMonth: parsed.billingMonth,
        previousReadingValue,
        submittedValue: parsed.submittedValue,
        approvedValue: null,
        consumptionKwh: evaluation.consumptionKwh,
        status: evaluation.status,
        flagReason: evaluation.flagReason,
        submittedByUserId: reader.id,
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ReadingConflictError(
        "A meter reading already exists for this subscription and billing month.",
        "DUPLICATE_MONTH",
      );
    }
    throw error;
  }
}

/**
 * Lists meter reading history scoped strictly to the signed-in user's role
 * (`ALL` for Operator, active `ASSIGNED_ROUTES` for Meter Reader, `OWN` for Subscriber).
 */
export async function listMeterReadings(
  user: User,
  filters: unknown = {},
  deps: { repository?: ReadingRepository } = {},
): Promise<MeterReadingWithContext[]> {
  const scope = requireRole(user, "readings:view");
  const signedIn = requireUser(user);
  const parsed = listReadingsQuerySchema.parse(filters);
  const repository = deps.repository ?? prismaReadingRepository;

  if (scope === "ALL") {
    return repository.findReadings({
      subscriptionId: parsed.subscriptionId,
      billingMonth: parsed.billingMonth,
      status: parsed.status,
      routeIds: parsed.routeId ? [parsed.routeId] : undefined,
    });
  }

  if (scope === "ASSIGNED_ROUTES") {
    const assignedRouteIds = await repository.findActiveAssignedRouteIds(signedIn.id);

    if (parsed.routeId) {
      requireRouteAccess(parsed.routeId, assignedRouteIds);
    }

    if (parsed.subscriptionId) {
      const subscription = await repository.findSubscriptionWithRoute(parsed.subscriptionId);
      if (subscription) {
        requireRouteAccess(subscription.subscriber.routeId, assignedRouteIds);
      }
    }

    if (assignedRouteIds.length === 0) {
      return [];
    }

    return repository.findReadings({
      subscriptionId: parsed.subscriptionId,
      billingMonth: parsed.billingMonth,
      status: parsed.status,
      routeIds: parsed.routeId ? [parsed.routeId] : assignedRouteIds,
    });
  }

  return repository.findReadings({
    subscriptionId: parsed.subscriptionId,
    billingMonth: parsed.billingMonth,
    status: parsed.status,
    routeIds: parsed.routeId ? [parsed.routeId] : undefined,
    ownerUserId: signedIn.id,
  });
}

/**
 * Retrieves a single meter reading if authorized by role, active route assignment,
 * or subscriber ownership (returning 404 NOT_FOUND for other subscribers' records).
 */
export async function getMeterReadingById(
  user: User,
  id: string,
  deps: { repository?: ReadingRepository } = {},
): Promise<MeterReadingWithContext> {
  const scope = requireRole(user, "readings:view");
  const signedIn = requireUser(user);
  const parsed = readingIdParamSchema.parse({ id });
  const repository = deps.repository ?? prismaReadingRepository;

  const reading = await repository.findReadingById(parsed.id);
  if (!reading) {
    throw new ReadingNotFoundError("Meter reading not found.");
  }

  const assignedRouteIds =
    scope === "ASSIGNED_ROUTES" ? await repository.findActiveAssignedRouteIds(signedIn.id) : [];

  requireRecordAccess(
    scope,
    signedIn,
    {
      routeId: reading.subscription.subscriber.routeId,
      ownerUserId: reading.subscription.subscriber.userId,
    },
    assignedRouteIds,
  );

  return reading;
}

/**
 * Loads active assigned routes, active subscriptions, prior effective readings, and
 * recent reading history serialized safely for the Meter Reader workspace UI.
 */
export async function getReaderWorkspaceData(
  user: User,
  deps: { repository?: ReadingRepository } = {},
): Promise<ReaderWorkspaceData> {
  requireRole(user, "readings:submit");
  const reader = requireUser(user);
  const repository = deps.repository ?? prismaReadingRepository;
  const assignments = await repository.findReaderRoutesWithActiveSubscriptions(reader.id);

  const routes: ReaderRouteOption[] = [];
  const subscribers: ReaderSubscriberItem[] = [];

  for (const assignment of assignments) {
    const { route } = assignment;
    routes.push({
      id: route.id,
      name: route.name,
      description: route.description,
    });

    for (const subscriber of route.subscribers) {
      for (const subscription of subscriber.subscriptions) {
        const latestReading = subscription.meterReadings[0] ?? null;
        const latestEffectiveRecord =
          subscription.meterReadings.find(
            (reading) =>
              reading.status === ReadingStatus.BASELINE ||
              reading.status === ReadingStatus.ACCEPTED ||
              reading.status === ReadingStatus.RESOLVED,
          ) ?? null;

        const latestEffectiveReading = latestEffectiveRecord
          ? getEffectiveReadingValue(latestEffectiveRecord).toString()
          : null;
        const latestConsumptionKwh = latestEffectiveRecord?.consumptionKwh
          ? latestEffectiveRecord.consumptionKwh.toString()
          : null;
        const highThresholdKwh = resolveHighConsumptionThreshold(
          latestEffectiveRecord?.consumptionKwh,
        ).toString();

        const history: SerializedReadingHistoryItem[] = subscription.meterReadings.map(
          (reading) => ({
            id: reading.id,
            billingMonth: reading.billingMonth.toISOString().slice(0, 7),
            previousReadingValue: reading.previousReadingValue?.toString() ?? null,
            submittedValue: reading.submittedValue.toString(),
            approvedValue: reading.approvedValue?.toString() ?? null,
            consumptionKwh: reading.consumptionKwh?.toString() ?? null,
            status: reading.status,
            flagReason: reading.flagReason,
            reviewNote: reading.reviewNote,
            createdAt: reading.createdAt.toISOString(),
          }),
        );

        subscribers.push({
          subscriptionId: subscription.id,
          subscriberId: subscriber.id,
          subscriberName: subscriber.fullName,
          address: `${subscriber.building.name}, ${subscriber.address}`,
          buildingName: subscriber.building.name,
          routeId: route.id,
          routeName: route.name,
          amperage: Number(subscription.amperage.toString()),
          latestEffectiveReading,
          latestBillingMonth: latestEffectiveRecord
            ? latestEffectiveRecord.billingMonth.toISOString().slice(0, 7)
            : null,
          latestConsumptionKwh,
          hasUnresolvedFlaggedReading: latestReading?.status === ReadingStatus.FLAGGED,
          highThresholdKwh,
          history,
        });
      }
    }
  }

  return { routes, subscribers };
}
