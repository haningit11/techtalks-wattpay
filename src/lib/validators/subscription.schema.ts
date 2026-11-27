import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { SubscriptionStatus } from "@/generated/prisma/enums";

// Matches PostgreSQL DECIMAL(6, 2): up to 4 integer digits and up to 2 decimal places.
const DECIMAL_6_2_REGEX = /^\d{1,4}(?:\.\d{1,2})?$/;
const ISO_DATE_SCHEMA = z.iso.date();

/**
 * Validates subscribed electrical amperage (`DECIMAL(6, 2)`, strictly > 0)
 * without floating-point precision loss.
 */
export const subscriptionAmperageSchema = z
  .union([z.string(), z.number()], {
    error: (issue) =>
      issue.input == null
        ? "Amperage is required."
        : "Enter a valid positive amperage.",
  })
  .transform((raw, ctx) => {
    let normalized: string;

    if (typeof raw === "number") {
      if (!Number.isFinite(raw)) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid positive amperage.",
        });
        return z.NEVER;
      }

      if (raw <= 0) {
        ctx.addIssue({
          code: "custom",
          message: "Amperage must be greater than zero.",
        });
        return z.NEVER;
      }

      normalized = String(raw);
    } else {
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Amperage is required.",
        });
        return z.NEVER;
      }

      if (/^-\d+(?:\.\d+)?$/.test(trimmed) || /^-\.\d+$/.test(trimmed)) {
        ctx.addIssue({
          code: "custom",
          message: "Amperage must be greater than zero.",
        });
        return z.NEVER;
      }

      normalized = trimmed;
    }

    if (!DECIMAL_6_2_REGEX.test(normalized)) {
      const message = /^\d+(?:\.\d+)?$/.test(normalized)
        ? "Amperage must have at most 4 integer digits and 2 decimal places."
        : "Enter a valid amperage with up to 4 integer digits and 2 decimal places.";
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }

    const decimal = new Prisma.Decimal(normalized);
    if (!decimal.gt(0)) {
      ctx.addIssue({
        code: "custom",
        message: "Amperage must be greater than zero.",
      });
      return z.NEVER;
    }

    return decimal;
  });

/**
 * Validates an ISO `YYYY-MM-DD` calendar date and normalizes it to UTC midnight
 * to align with Prisma's `@db.Date` columns.
 */
export const subscriptionDateSchema = z
  .string({
    error: (issue) =>
      issue.input == null
        ? "Date is required."
        : "Date must be a valid YYYY-MM-DD date.",
  })
  .transform((raw, ctx) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Date is required.",
      });
      return z.NEVER;
    }

    if (!ISO_DATE_SCHEMA.safeParse(trimmed).success) {
      ctx.addIssue({
        code: "custom",
        message: "Date must be a valid YYYY-MM-DD date.",
      });
      return z.NEVER;
    }

    return new Date(`${trimmed}T00:00:00.000Z`);
  });

export const subscriptionEndDateSchema = z.union([subscriptionDateSchema, z.null()]);

export const subscriptionStatusSchema = z.enum([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.INACTIVE,
  SubscriptionStatus.ENDED,
]);

export const createSubscriptionSchema = z
  .strictObject({
    subscriberId: z.uuid("Invalid subscriber ID."),
    amperage: subscriptionAmperageSchema,
    startDate: subscriptionDateSchema,
    endDate: subscriptionEndDateSchema.optional(),
    status: subscriptionStatusSchema.default(SubscriptionStatus.ACTIVE),
  })
  .superRefine((data, ctx) => {
    if (data.endDate != null && data.endDate.getTime() < data.startDate.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date cannot be earlier than start date.",
      });
    }
  });

export const updateSubscriptionSchema = z
  .strictObject({
    amperage: subscriptionAmperageSchema.optional(),
    startDate: subscriptionDateSchema.optional(),
    endDate: subscriptionEndDateSchema.optional(),
    status: subscriptionStatusSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.amperage === undefined &&
      data.startDate === undefined &&
      data.endDate === undefined &&
      data.status === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field must be provided to update a subscription.",
      });
    }

    if (
      data.startDate !== undefined &&
      data.endDate != null &&
      data.endDate.getTime() < data.startDate.getTime()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date cannot be earlier than start date.",
      });
    }
  });

export const listSubscriptionsQuerySchema = z.strictObject({
  subscriberId: z.uuid("Invalid subscriber ID.").optional(),
  routeId: z.uuid("Invalid route ID.").optional(),
  status: subscriptionStatusSchema.optional(),
});

export const subscriptionIdParamSchema = z.strictObject({
  id: z.uuid("Invalid subscription ID."),
});

export type CreateSubscriptionInput = z.input<typeof createSubscriptionSchema>;
export type ParsedCreateSubscription = z.output<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.input<typeof updateSubscriptionSchema>;
export type ParsedUpdateSubscription = z.output<typeof updateSubscriptionSchema>;
export type ListSubscriptionsQuery = z.output<typeof listSubscriptionsQuerySchema>;
export type SubscriptionIdParam = z.output<typeof subscriptionIdParamSchema>;
