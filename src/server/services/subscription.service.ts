import { Prisma, type PrismaClient, type Subscription } from "@/generated/prisma/client";
import { SubscriptionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  createSubscriptionSchema,
  listSubscriptionsQuerySchema,
  subscriptionIdParamSchema,
  updateSubscriptionSchema,
} from "@/lib/validators/subscription.schema";
import { requireRole, type SessionUser } from "@/server/auth/guards";

type User = SessionUser | null | undefined;
type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

// Configurable single-point rule (Sprint 2 Guide §13 / TDD §4.1.6):
// Restrict each subscriber to at most one ACTIVE electricity subscription at a time.
export const MAX_ACTIVE_SUBSCRIPTIONS_PER_SUBSCRIBER = 1;

export class SubscriptionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionValidationError";
  }
}

export class SubscriptionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionNotFoundError";
  }
}

export class SubscriptionConflictError extends Error {
  constructor(
    message: string,
    readonly reason: "DUPLICATE_ACTIVE_SUBSCRIPTION" = "DUPLICATE_ACTIVE_SUBSCRIPTION",
  ) {
    super(message);
    this.name = "SubscriptionConflictError";
  }
}

export interface SubscriberSummary {
  id: string;
  isActive: boolean;
}

export interface SubscriptionWithContext extends Subscription {
  subscriber: {
    id: string;
    fullName: string;
    phoneNumber: string;
    address: string;
    isActive: boolean;
    buildingId: string;
    routeId: string;
    building: { id: string; name: string };
    route: { id: string; name: string };
  };
}

export interface SubscriptionListCriteria {
  subscriberId?: string;
  routeId?: string;
  status?: SubscriptionStatus;
}

export interface CreateSubscriptionRecordInput {
  subscriberId: string;
  amperage: Prisma.Decimal;
  startDate: Date;
  endDate: Date | null;
  status: SubscriptionStatus;
}

export interface UpdateSubscriptionRecordInput {
  amperage?: Prisma.Decimal;
  startDate?: Date;
  endDate?: Date | null;
  status?: SubscriptionStatus;
}

export interface SubscriptionRepository {
  withSubscriberLock<T>(
    subscriberId: string,
    work: (repository: SubscriptionRepository) => Promise<T>,
  ): Promise<T>;
  withSubscriptionLock<T>(
    subscriptionId: string,
    work: (repository: SubscriptionRepository) => Promise<T>,
  ): Promise<T>;
  findSubscriberById(subscriberId: string): Promise<SubscriberSummary | null>;
  findActiveSubscriptionForSubscriber(
    subscriberId: string,
    excludeSubscriptionId?: string,
  ): Promise<{ id: string } | null>;
  findSubscriptions(criteria: SubscriptionListCriteria): Promise<SubscriptionWithContext[]>;
  findSubscriptionById(id: string): Promise<SubscriptionWithContext | null>;
  createSubscription(data: CreateSubscriptionRecordInput): Promise<SubscriptionWithContext>;
  updateSubscription(
    id: string,
    data: UpdateSubscriptionRecordInput,
  ): Promise<SubscriptionWithContext>;
}

const SUBSCRIPTION_WITH_CONTEXT_INCLUDE = {
  subscriber: {
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
      address: true,
      isActive: true,
      buildingId: true,
      routeId: true,
      building: { select: { id: true, name: true } },
      route: { select: { id: true, name: true } },
    },
  },
} as const;

function makePrismaSubscriptionRepository(client: PrismaExecutor): SubscriptionRepository {
  return {
    withSubscriberLock(subscriberId, work) {
      return prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "Subscriber" WHERE "id" = ${subscriberId}::uuid FOR UPDATE
          `;
          if (rows.length === 0) {
            throw new SubscriptionNotFoundError("Subscriber not found.");
          }
          return work(makePrismaSubscriptionRepository(tx));
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    },

    withSubscriptionLock(subscriptionId, work) {
      return prisma.$transaction(
        async (tx) => {
          const target = await tx.subscription.findUnique({
            where: { id: subscriptionId },
            select: { id: true, subscriberId: true },
          });
          if (!target) {
            throw new SubscriptionNotFoundError("Subscription not found.");
          }

          // Lock parent Subscriber before Subscription to prevent lock-order deadlocks
          // with concurrent createSubscription transactions.
          const subscriberRows = await tx.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "Subscriber" WHERE "id" = ${target.subscriberId}::uuid FOR UPDATE
          `;
          if (subscriberRows.length === 0) {
            throw new SubscriptionNotFoundError("Subscriber not found.");
          }

          const subscriptionRows = await tx.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "Subscription" WHERE "id" = ${subscriptionId}::uuid FOR UPDATE
          `;
          if (subscriptionRows.length === 0) {
            throw new SubscriptionNotFoundError("Subscription not found.");
          }

          return work(makePrismaSubscriptionRepository(tx));
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    },

    findSubscriberById(subscriberId) {
      return client.subscriber.findUnique({
        where: { id: subscriberId },
        select: { id: true, isActive: true },
      });
    },

    findActiveSubscriptionForSubscriber(subscriberId, excludeSubscriptionId) {
      return client.subscription.findFirst({
        where: {
          subscriberId,
          status: SubscriptionStatus.ACTIVE,
          ...(excludeSubscriptionId !== undefined
            ? { id: { not: excludeSubscriptionId } }
            : {}),
        },
        select: { id: true },
      });
    },

    findSubscriptions(criteria) {
      const where: Prisma.SubscriptionWhereInput = {
        ...(criteria.subscriberId !== undefined ? { subscriberId: criteria.subscriberId } : {}),
        ...(criteria.status !== undefined ? { status: criteria.status } : {}),
        ...(criteria.routeId !== undefined
          ? { subscriber: { routeId: criteria.routeId } }
          : {}),
      };

      return client.subscription.findMany({
        where,
        include: SUBSCRIPTION_WITH_CONTEXT_INCLUDE,
        orderBy: [{ status: "asc" }, { startDate: "desc" }, { createdAt: "desc" }],
      });
    },

    findSubscriptionById(id) {
      return client.subscription.findUnique({
        where: { id },
        include: SUBSCRIPTION_WITH_CONTEXT_INCLUDE,
      });
    },

    createSubscription(data) {
      return client.subscription.create({
        data,
        include: SUBSCRIPTION_WITH_CONTEXT_INCLUDE,
      });
    },

    updateSubscription(id, data) {
      return client.subscription.update({
        where: { id },
        data,
        include: SUBSCRIPTION_WITH_CONTEXT_INCLUDE,
      });
    },
  };
}

const prismaSubscriptionRepository = makePrismaSubscriptionRepository(prisma);

/**
 * Lists electricity subscriptions for Operators, optionally filtered by
 * subscriber, collection route, or subscription status.
 */
export async function listSubscriptions(
  user: User,
  filters: unknown = {},
  deps: { repository?: SubscriptionRepository } = {},
): Promise<SubscriptionWithContext[]> {
  requireRole(user, "setup:manage");
  const parsed = listSubscriptionsQuerySchema.parse(filters);
  const repository = deps.repository ?? prismaSubscriptionRepository;

  return repository.findSubscriptions({
    subscriberId: parsed.subscriberId,
    routeId: parsed.routeId,
    status: parsed.status,
  });
}

/**
 * Retrieves a single subscription with its subscriber, building, and route context.
 */
export async function getSubscriptionById(
  user: User,
  id: string,
  deps: { repository?: SubscriptionRepository } = {},
): Promise<SubscriptionWithContext> {
  requireRole(user, "setup:manage");
  const parsed = subscriptionIdParamSchema.parse({ id });
  const repository = deps.repository ?? prismaSubscriptionRepository;

  const subscription = await repository.findSubscriptionById(parsed.id);
  if (!subscription) {
    throw new SubscriptionNotFoundError("Subscription not found.");
  }

  return subscription;
}

/**
 * Creates a new electricity subscription linked to an existing subscriber while
 * enforcing active-subscriber and single-active-subscription constraints.
 */
export async function createSubscription(
  user: User,
  input: unknown,
  deps: { repository?: SubscriptionRepository } = {},
): Promise<SubscriptionWithContext> {
  requireRole(user, "setup:manage");
  const parsed = createSubscriptionSchema.parse(input);
  const repository = deps.repository ?? prismaSubscriptionRepository;

  return repository.withSubscriberLock(parsed.subscriberId, async (txRepo) => {
    const subscriber = await txRepo.findSubscriberById(parsed.subscriberId);
    if (!subscriber) {
      throw new SubscriptionNotFoundError("Subscriber not found.");
    }

    if (parsed.status === SubscriptionStatus.ACTIVE && !subscriber.isActive) {
      throw new SubscriptionValidationError(
        "Cannot create an active subscription for an inactive subscriber.",
      );
    }

    if (
      parsed.status === SubscriptionStatus.ACTIVE &&
      MAX_ACTIVE_SUBSCRIPTIONS_PER_SUBSCRIBER === 1
    ) {
      const existingActive = await txRepo.findActiveSubscriptionForSubscriber(
        parsed.subscriberId,
      );
      if (existingActive) {
        throw new SubscriptionConflictError(
          "This subscriber already has an active subscription.",
          "DUPLICATE_ACTIVE_SUBSCRIPTION",
        );
      }
    }

    return txRepo.createSubscription({
      subscriberId: parsed.subscriberId,
      amperage: parsed.amperage,
      startDate: parsed.startDate,
      endDate: parsed.endDate ?? null,
      status: parsed.status,
    });
  });
}

/**
 * Updates amperage, service dates, or status (`ACTIVE`, `INACTIVE`, `ENDED`) on
 * an existing subscription while preserving history and enforcing date/status rules.
 */
export async function updateSubscription(
  user: User,
  id: string,
  input: unknown,
  deps: { repository?: SubscriptionRepository } = {},
): Promise<SubscriptionWithContext> {
  requireRole(user, "setup:manage");
  const parsedId = subscriptionIdParamSchema.parse({ id });
  const parsed = updateSubscriptionSchema.parse(input);
  const repository = deps.repository ?? prismaSubscriptionRepository;

  return repository.withSubscriptionLock(parsedId.id, async (txRepo) => {
    const current = await txRepo.findSubscriptionById(parsedId.id);
    if (!current) {
      throw new SubscriptionNotFoundError("Subscription not found.");
    }

    const effectiveStartDate = parsed.startDate ?? current.startDate;
    const effectiveEndDate =
      parsed.endDate !== undefined ? parsed.endDate : current.endDate;
    const effectiveStatus = parsed.status ?? current.status;

    if (
      effectiveEndDate !== null &&
      effectiveEndDate.getTime() < effectiveStartDate.getTime()
    ) {
      throw new SubscriptionValidationError("End date cannot be earlier than start date.");
    }

    if (effectiveStatus === SubscriptionStatus.ACTIVE) {
      if (parsed.status === SubscriptionStatus.ACTIVE && !current.subscriber.isActive) {
        throw new SubscriptionValidationError(
          "Cannot activate a subscription for an inactive subscriber.",
        );
      }

      if (MAX_ACTIVE_SUBSCRIPTIONS_PER_SUBSCRIBER === 1) {
        const conflictingActive = await txRepo.findActiveSubscriptionForSubscriber(
          current.subscriberId,
          current.id,
        );
        if (conflictingActive) {
          throw new SubscriptionConflictError(
            "This subscriber already has an active subscription.",
            "DUPLICATE_ACTIVE_SUBSCRIPTION",
          );
        }
      }
    }

    const updateData: UpdateSubscriptionRecordInput = {};
    if (parsed.amperage !== undefined) updateData.amperage = parsed.amperage;
    if (parsed.startDate !== undefined) updateData.startDate = parsed.startDate;
    if (parsed.endDate !== undefined) updateData.endDate = parsed.endDate;
    if (parsed.status !== undefined) updateData.status = parsed.status;

    return txRepo.updateSubscription(current.id, updateData);
  });
}
