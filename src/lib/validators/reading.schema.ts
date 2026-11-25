import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ReadingStatus } from "@/generated/prisma/enums";

// Matches PostgreSQL DECIMAL(12, 3): up to 9 integer digits and up to 3 decimal places.
const DECIMAL_12_3_REGEX = /^\d{1,9}(?:\.\d{1,3})?$/;
const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_SCHEMA = z.iso.date();

/**
 * Validates a cumulative meter reading input without floating-point loss,
 * rejecting missing, non-numeric, negative, or out-of-precision values.
 */
export const readingValueSchema = z
  .union([z.string(), z.number()], {
    error: (issue) =>
      issue.input == null
        ? "Meter reading value is required."
        : "Enter a valid numeric meter reading.",
  })
  .transform((raw, ctx) => {
    if (typeof raw === "number") {
      if (!Number.isFinite(raw)) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid numeric meter reading.",
        });
        return z.NEVER;
      }

      if (raw < 0) {
        ctx.addIssue({
          code: "custom",
          message: "Meter reading value cannot be negative.",
        });
        return z.NEVER;
      }

      const normalized = String(raw);
      if (!DECIMAL_12_3_REGEX.test(normalized)) {
        ctx.addIssue({
          code: "custom",
          message: "Meter reading must have at most 9 digits and 3 decimal places.",
        });
        return z.NEVER;
      }

      return new Prisma.Decimal(normalized);
    }

    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Meter reading value is required.",
      });
      return z.NEVER;
    }

    if (/^-\d+(?:\.\d+)?$/.test(trimmed) || /^-\.\d+$/.test(trimmed)) {
      ctx.addIssue({
        code: "custom",
        message: "Meter reading value cannot be negative.",
      });
      return z.NEVER;
    }

    if (!DECIMAL_12_3_REGEX.test(trimmed)) {
      const message = /^\d+(?:\.\d+)?$/.test(trimmed)
        ? "Meter reading must have at most 9 digits and 3 decimal places."
        : "Enter a valid meter reading with up to 9 digits and 3 decimal places.";
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }

    return new Prisma.Decimal(trimmed);
  });

/**
 * Accepts `YYYY-MM` or valid ISO `YYYY-MM-DD` dates and normalizes them to the
 * first UTC day of that month to match MeterReading's `@db.Date` unique key.
 */
export const billingMonthSchema = z
  .string({
    error: (issue) =>
      issue.input == null
        ? "Billing month is required."
        : "Billing month must be a valid YYYY-MM or YYYY-MM-DD date.",
  })
  .transform((raw, ctx) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Billing month is required.",
      });
      return z.NEVER;
    }

    const isValidMonth =
      YEAR_MONTH_REGEX.test(trimmed) || ISO_DATE_SCHEMA.safeParse(trimmed).success;

    if (!isValidMonth) {
      ctx.addIssue({
        code: "custom",
        message: "Billing month must be a valid YYYY-MM or YYYY-MM-DD date.",
      });
      return z.NEVER;
    }

    return new Date(`${trimmed.slice(0, 7)}-01T00:00:00.000Z`);
  });

export const readingStatusSchema = z.enum([
  ReadingStatus.BASELINE,
  ReadingStatus.ACCEPTED,
  ReadingStatus.FLAGGED,
  ReadingStatus.RESOLVED,
]);

export const submitReadingSchema = z.strictObject({
  subscriptionId: z.uuid("Invalid subscription ID."),
  billingMonth: billingMonthSchema,
  submittedValue: readingValueSchema,
});

export const listReadingsQuerySchema = z.strictObject({
  subscriptionId: z.uuid("Invalid subscription ID.").optional(),
  routeId: z.uuid("Invalid route ID.").optional(),
  billingMonth: billingMonthSchema.optional(),
  status: readingStatusSchema.optional(),
});

export const readingIdParamSchema = z.strictObject({
  id: z.uuid("Invalid reading ID."),
});

export type SubmitReadingInput = z.input<typeof submitReadingSchema>;
export type ParsedSubmitReading = z.output<typeof submitReadingSchema>;
export type ListReadingsQuery = z.output<typeof listReadingsQuerySchema>;
export type ReadingIdParam = z.output<typeof readingIdParamSchema>;
