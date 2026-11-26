import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { ReadingStatus } from "@/generated/prisma/enums";
import {
  billingMonthSchema,
  readingValueSchema,
  submitReadingSchema,
} from "@/lib/validators/reading.schema";
import {
  BASELINE_HIGH_CONSUMPTION_THRESHOLD_KWH,
  evaluateMeterReading,
  getEffectiveReadingValue,
  HIGH_CONSUMPTION_MULTIPLIER,
  READING_FLAG_REASONS,
} from "@/server/services/reading.service";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const VALID_SUBSCRIPTION_ID = "40000000-0000-4000-8000-000000000001";

describe("Meter reading input validation (SCRUM-76 / SCRUM-78)", () => {
  it("Case 2 — Missing reading: rejects missing, null, or blank submitted values", () => {
    const missingPayloads: unknown[] = [
      { subscriptionId: VALID_SUBSCRIPTION_ID, billingMonth: "2026-11" },
      { subscriptionId: VALID_SUBSCRIPTION_ID, billingMonth: "2026-11", submittedValue: null },
      { subscriptionId: VALID_SUBSCRIPTION_ID, billingMonth: "2026-11", submittedValue: "" },
      { subscriptionId: VALID_SUBSCRIPTION_ID, billingMonth: "2026-11", submittedValue: "   " },
    ];

    for (const payload of missingPayloads) {
      const result = submitReadingSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const message = result.error.issues[0]?.message ?? "";
        expect(message).toBe("Meter reading value is required.");
      }
    }
  });

  it("Case 3 — Negative reading: rejects negative numbers and negative numeric strings", () => {
    const negativeValues: Array<string | number> = [-1, -0.001, "-15", "-0.5"];

    for (const submittedValue of negativeValues) {
      const result = submitReadingSchema.safeParse({
        subscriptionId: VALID_SUBSCRIPTION_ID,
        billingMonth: "2026-11",
        submittedValue,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Meter reading value cannot be negative.");
      }
    }
  });

  it("rejects non-numeric values, unsupported decimal precision, invalid UUIDs, and extra fields", () => {
    expect(readingValueSchema.safeParse("abc").success).toBe(false);
    expect(readingValueSchema.safeParse(Number.NaN).success).toBe(false);
    expect(readingValueSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
    expect(readingValueSchema.safeParse("12.3456").success).toBe(false);
    expect(readingValueSchema.safeParse("1000000000").success).toBe(false);
    expect(readingValueSchema.safeParse(true).success).toBe(false);

    expect(
      submitReadingSchema.safeParse({
        subscriptionId: "not-a-uuid",
        billingMonth: "2026-11",
        submittedValue: 1350,
      }).success,
    ).toBe(false);

    expect(
      submitReadingSchema.safeParse({
        subscriptionId: VALID_SUBSCRIPTION_ID,
        billingMonth: "2026-11",
        submittedValue: 1350,
        unexpectedField: "ignored",
      }).success,
    ).toBe(false);

    const zeroResult = submitReadingSchema.safeParse({
      subscriptionId: VALID_SUBSCRIPTION_ID,
      billingMonth: "2026-11",
      submittedValue: 0,
    });
    expect(zeroResult.success).toBe(true);
    if (zeroResult.success) {
      expect(zeroResult.data.submittedValue.eq(0)).toBe(true);
    }

    const decimalResult = submitReadingSchema.safeParse({
      subscriptionId: VALID_SUBSCRIPTION_ID,
      billingMonth: "2026-11",
      submittedValue: "1350.125",
    });
    expect(decimalResult.success).toBe(true);
    if (decimalResult.success) {
      expect(decimalResult.data.submittedValue.toString()).toBe("1350.125");
    }
  });

  it("normalizes valid billing months to the first UTC day and rejects malformed dates", () => {
    const shortMonth = billingMonthSchema.safeParse("2026-11");
    const fullDate = billingMonthSchema.safeParse("2026-11-18");

    expect(shortMonth.success).toBe(true);
    expect(fullDate.success).toBe(true);
    if (shortMonth.success && fullDate.success) {
      expect(shortMonth.data.toISOString()).toBe("2026-11-01T00:00:00.000Z");
      expect(fullDate.data.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    }

    expect(billingMonthSchema.safeParse("2026-13").success).toBe(false);
    expect(billingMonthSchema.safeParse("2026-02-30").success).toBe(false);
    expect(billingMonthSchema.safeParse("").success).toBe(false);
  });
});

describe("Meter reading evaluation and consumption rules (SCRUM-77 / SCRUM-78)", () => {
  it("Case 1 — Valid reading: accepts normal increases and computes consumption", () => {
    const routeAAcceptedCases = [
      { previous: "1200", submitted: "1350", expectedConsumption: "150" },
      { previous: "2000", submitted: "2080", expectedConsumption: "80" },
      { previous: "500", submitted: "700", expectedConsumption: "200" },
      { previous: "3100", submitted: "3160", expectedConsumption: "60" },
      { previous: "1200.250", submitted: "1250.375", expectedConsumption: "50.125" },
    ];

    for (const testCase of routeAAcceptedCases) {
      const result = evaluateMeterReading({
        previousReadingValue: new Prisma.Decimal(testCase.previous),
        submittedValue: new Prisma.Decimal(testCase.submitted),
      });

      expect(result.status).toBe(ReadingStatus.ACCEPTED);
      expect(result.consumptionKwh?.toString()).toBe(testCase.expectedConsumption);
      expect(result.flagReason).toBeNull();
    }
  });

  it("Case 4 — Lower reading: flags for Operator review and stores null consumption", () => {
    // Matches Route A S5 test case (previous = 900, submitted = 850).
    const result = evaluateMeterReading({
      previousReadingValue: new Prisma.Decimal("900"),
      submittedValue: new Prisma.Decimal("850"),
    });

    expect(result.status).toBe(ReadingStatus.FLAGGED);
    expect(result.consumptionKwh).toBeNull();
    expect(result.flagReason).toBe(READING_FLAG_REASONS.LOWER_THAN_PREVIOUS);
  });

  it("Case 6 — Same reading: calculates zero consumption and flags for confirmation", () => {
    const result = evaluateMeterReading({
      previousReadingValue: new Prisma.Decimal("1200"),
      submittedValue: new Prisma.Decimal("1200"),
    });

    expect(result.status).toBe(ReadingStatus.FLAGGED);
    expect(result.consumptionKwh?.eq(0)).toBe(true);
    expect(result.flagReason).toBe(READING_FLAG_REASONS.ZERO_CONSUMPTION);
  });

  it("Case 5 — Unusually high consumption (> 3x prior month rule): accepts boundary and flags above threshold", () => {
    const previousReadingValue = new Prisma.Decimal("1350");
    const previousConsumptionKwh = new Prisma.Decimal("100");
    const expectedThreshold = previousConsumptionKwh.mul(HIGH_CONSUMPTION_MULTIPLIER);

    expect(expectedThreshold.toString()).toBe("300");

    const atThreshold = evaluateMeterReading({
      previousReadingValue,
      previousConsumptionKwh,
      submittedValue: new Prisma.Decimal("1650"),
    });
    expect(atThreshold.status).toBe(ReadingStatus.ACCEPTED);
    expect(atThreshold.consumptionKwh?.toString()).toBe("300");
    expect(atThreshold.flagReason).toBeNull();

    const aboveThreshold = evaluateMeterReading({
      previousReadingValue,
      previousConsumptionKwh,
      submittedValue: new Prisma.Decimal("1650.001"),
    });
    expect(aboveThreshold.status).toBe(ReadingStatus.FLAGGED);
    expect(aboveThreshold.consumptionKwh?.toString()).toBe("300.001");
    expect(aboveThreshold.flagReason).toBe(READING_FLAG_REASONS.UNUSUALLY_HIGH);
  });

  it("Case 5 — Unusually high consumption after BASELINE (500 kWh fallback): accepts 500 kWh and flags above 500 kWh", () => {
    expect(BASELINE_HIGH_CONSUMPTION_THRESHOLD_KWH.toString()).toBe("500");

    const atFallbackLimit = evaluateMeterReading({
      previousReadingValue: new Prisma.Decimal("1200"),
      previousConsumptionKwh: null,
      submittedValue: new Prisma.Decimal("1700"),
    });
    expect(atFallbackLimit.status).toBe(ReadingStatus.ACCEPTED);
    expect(atFallbackLimit.consumptionKwh?.toString()).toBe("500");
    expect(atFallbackLimit.flagReason).toBeNull();

    const aboveFallbackLimit = evaluateMeterReading({
      previousReadingValue: new Prisma.Decimal("1200"),
      previousConsumptionKwh: null,
      submittedValue: new Prisma.Decimal("1701"),
    });
    expect(aboveFallbackLimit.status).toBe(ReadingStatus.FLAGGED);
    expect(aboveFallbackLimit.consumptionKwh?.toString()).toBe("501");
    expect(aboveFallbackLimit.flagReason).toBe(READING_FLAG_REASONS.UNUSUALLY_HIGH);
  });

  it("supports an explicit high-consumption threshold override", () => {
    const result = evaluateMeterReading({
      previousReadingValue: new Prisma.Decimal("1000"),
      submittedValue: new Prisma.Decimal("1251"),
      highConsumptionThresholdKwh: new Prisma.Decimal("250"),
    });

    expect(result.status).toBe(ReadingStatus.FLAGGED);
    expect(result.highThresholdKwh.toString()).toBe("250");
    expect(result.consumptionKwh?.toString()).toBe("251");
  });

  it("uses approvedValue for RESOLVED and BASELINE readings and submittedValue for ACCEPTED readings", () => {
    const resolved = getEffectiveReadingValue({
      status: ReadingStatus.RESOLVED,
      submittedValue: new Prisma.Decimal("850"),
      approvedValue: new Prisma.Decimal("950"),
    });
    expect(resolved.toString()).toBe("950");

    const baseline = getEffectiveReadingValue({
      status: ReadingStatus.BASELINE,
      submittedValue: new Prisma.Decimal("1200"),
      approvedValue: new Prisma.Decimal("1200"),
    });
    expect(baseline.toString()).toBe("1200");

    const accepted = getEffectiveReadingValue({
      status: ReadingStatus.ACCEPTED,
      submittedValue: new Prisma.Decimal("1350"),
      approvedValue: null,
    });
    expect(accepted.toString()).toBe("1350");
  });
});
