import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

// Strings avoid losing precision before Decimal sees the value. Reject values the
// database would otherwise round or reject because of its numeric column sizes.
function decimalField(integerDigits: number, scale: number, positive = false) {
  return z.string().regex(new RegExp(`^\\d{1,${integerDigits}}(?:\\.\\d{1,${scale}})?$`), "Enter a decimal within the supported precision.")
    .transform((value) => new Prisma.Decimal(value))
    .refine((value) => positive ? value.gt(0) : value.gte(0), positive ? "Must be positive." : "Must not be negative.");
}

// The database stores a date; canonicalize all dates in a month to its first
// UTC day so the monthly unique constraints cannot be bypassed by another day.
export const billingMonthSchema = z.iso.date().transform((value) => new Date(`${value.slice(0, 7)}-01T00:00:00.000Z`));

export const createTariffSchema = z.strictObject({
  name: z.string().trim().min(1).max(150),
  billingMonth: billingMonthSchema,
  amperage: decimalField(4, 2, true),
  ratePerKwh: decimalField(8, 4),
  fixedFee: decimalField(10, 2),
  currency: z.literal("USD"),
});

export const updateTariffSchema = createTariffSchema.partial();
export const listTariffsSchema = z.strictObject({
  billingMonth: billingMonthSchema.optional(),
  isActive: z.boolean().optional(),
});
