import { Prisma, type MeterReading } from "@/generated/prisma/client";
import { ReadingStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { readingIdParamSchema, readingValueSchema } from "@/lib/validators/reading.schema";
import { requireRole, requireUser, type SessionUser } from "@/server/auth/guards";
import { z } from "zod";

const reviewSchema = z.strictObject({
  approvedValue: readingValueSchema,
  reviewNote: z.string({ error: "Review note is required." }).trim().min(1, "Review note is required."),
});

export class ReadingReviewNotFoundError extends Error {
  constructor() { super("Meter reading not found."); this.name = "ReadingReviewNotFoundError"; }
}

export type ReadingReviewConflictReason =
  | "NOT_FLAGGED" | "LATER_READING" | "EXISTING_BILL" | "MISSING_PREVIOUS_VALUE" | "CONCURRENT_RESOLUTION";

export class ReadingReviewConflictError extends Error {
  constructor(readonly reason: ReadingReviewConflictReason, message: string) {
    super(message);
    this.name = "ReadingReviewConflictError";
  }
}

export class ReadingReviewValidationError extends Error {
  readonly reason = "APPROVED_BELOW_PREVIOUS";
  constructor() { super("Approved value cannot be lower than the previous reading."); this.name = "ReadingReviewValidationError"; }
}

type ReviewUpdate = {
  approvedValue: Prisma.Decimal;
  consumptionKwh: Prisma.Decimal;
  status: typeof ReadingStatus.RESOLVED;
  reviewedByUserId: string;
  reviewedAt: Date;
  reviewNote: string;
};

type AuditInput = {
  userId: string;
  action: "READING_RESOLVED";
  entityType: "MeterReading";
  entityId: string;
  oldValue: Prisma.InputJsonObject;
  newValue: Prisma.InputJsonObject;
  description: string;
};

export interface ReadingReviewTransaction {
  lockReading(id: string): Promise<void>;
  findReading(id: string): Promise<MeterReading | null>;
  findLaterReading(subscriptionId: string, billingMonth: Date): Promise<{ id: string } | null>;
  findBill(readingId: string): Promise<{ id: string } | null>;
  updateFlaggedReading(id: string, data: ReviewUpdate): Promise<number>;
  createAudit(data: AuditInput): Promise<void>;
}

export interface ReadingReviewRepository {
  findReading(id: string): Promise<MeterReading | null>;
  withSubscriptionLock<T>(subscriptionId: string, work: (tx: ReadingReviewTransaction) => Promise<T>): Promise<T>;
}

const repository: ReadingReviewRepository = {
  findReading: (id) => prisma.meterReading.findUnique({ where: { id } }),
  withSubscriptionLock: (subscriptionId, work) => prisma.$transaction(async (client) => {
    const rows = await client.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Subscription" WHERE "id" = ${subscriptionId}::uuid FOR UPDATE`;
    if (rows.length !== 1) throw new ReadingReviewNotFoundError();
    return work({
      lockReading: async (id) => {
        await client.$queryRaw`SELECT "id" FROM "MeterReading" WHERE "id" = ${id}::uuid FOR UPDATE`;
      },
      findReading: (id) => client.meterReading.findUnique({ where: { id } }),
      findLaterReading: (id, month) => client.meterReading.findFirst({
        where: { subscriptionId: id, billingMonth: { gt: month } }, select: { id: true },
      }),
      findBill: (id) => client.bill.findUnique({ where: { meterReadingId: id }, select: { id: true } }),
      updateFlaggedReading: async (id, data) => (await client.meterReading.updateMany({
        where: { id, status: ReadingStatus.FLAGGED }, data,
      })).count,
      createAudit: async (data) => { await client.auditLog.create({ data }); },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }),
};

function snapshot(reading: MeterReading): Prisma.InputJsonObject {
  return {
    status: reading.status,
    submittedValue: reading.submittedValue.toString(),
    approvedValue: reading.approvedValue?.toString() ?? null,
    previousReadingValue: reading.previousReadingValue?.toString() ?? null,
    consumptionKwh: reading.consumptionKwh?.toString() ?? null,
    flagReason: reading.flagReason,
    submittedByUserId: reading.submittedByUserId,
    reviewedByUserId: reading.reviewedByUserId,
    reviewedAt: reading.reviewedAt?.toISOString() ?? null,
    reviewNote: reading.reviewNote,
  };
}

export async function resolveFlaggedReading(
  user: SessionUser | null | undefined,
  readingId: string,
  input: unknown,
  deps: { repository?: ReadingReviewRepository } = {},
): Promise<MeterReading> {
  requireRole(user, "readings:review");
  const reviewer = requireUser(user);
  const { id } = readingIdParamSchema.parse({ id: readingId });
  const parsed = reviewSchema.parse(input);
  const repo = deps.repository ?? repository;
  const initial = await repo.findReading(id);
  if (!initial) throw new ReadingReviewNotFoundError();

  return repo.withSubscriptionLock(initial.subscriptionId, async (tx) => {
    // Also serialize a concurrent Bill insert, whose foreign key takes a key-share lock.
    await tx.lockReading(id);
    const reading = await tx.findReading(id);
    if (!reading) throw new ReadingReviewNotFoundError();
    if (reading.subscriptionId !== initial.subscriptionId) {
      throw new ReadingReviewConflictError("CONCURRENT_RESOLUTION", "Reading changed during review.");
    }
    if (reading.status !== ReadingStatus.FLAGGED) {
      throw new ReadingReviewConflictError("NOT_FLAGGED", "Only flagged readings can be reviewed.");
    }
    if (await tx.findLaterReading(reading.subscriptionId, reading.billingMonth)) {
      throw new ReadingReviewConflictError("LATER_READING", "A later reading exists for this subscription.");
    }
    if (await tx.findBill(id)) {
      throw new ReadingReviewConflictError("EXISTING_BILL", "A bill already references this reading.");
    }
    if (reading.previousReadingValue === null) {
      throw new ReadingReviewConflictError("MISSING_PREVIOUS_VALUE", "The previous reading value is missing.");
    }
    if (parsed.approvedValue.lt(reading.previousReadingValue)) throw new ReadingReviewValidationError();

    const data: ReviewUpdate = {
      approvedValue: parsed.approvedValue,
      consumptionKwh: parsed.approvedValue.minus(reading.previousReadingValue),
      status: ReadingStatus.RESOLVED,
      reviewedByUserId: reviewer.id,
      reviewedAt: new Date(),
      reviewNote: parsed.reviewNote,
    };
    if (await tx.updateFlaggedReading(id, data) !== 1) {
      throw new ReadingReviewConflictError("CONCURRENT_RESOLUTION", "The reading changed during review.");
    }
    const updated = await tx.findReading(id);
    if (!updated) throw new ReadingReviewNotFoundError();
    await tx.createAudit({
      userId: reviewer.id, action: "READING_RESOLVED", entityType: "MeterReading", entityId: id,
      oldValue: snapshot(reading), newValue: snapshot(updated),
      description: "Operator resolved a flagged meter reading.",
    });
    return updated;
  });
}
