"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type {
  ReaderSubscriberItem,
  SerializedReadingHistoryItem,
} from "@/server/services/reading.service";
import Button from "@/ui/components/actions/Button";
import Alert from "@/ui/components/feedback/Alert";
import {
  formatBillingMonth,
  formatKwh,
  normalizeApiReading,
  ReadingFeedbackBanner,
  ReadingStatusBadge,
  ReadingValidationBanner,
  type PreviewStatus,
  type SubmissionFeedback,
} from "@/components/features/readings/ReadingStatus";

const READING_VALUE_PATTERN = /^\d{1,9}(?:\.\d{1,3})?$/;
const DEFAULT_BASELINE_THRESHOLD_KWH = 500;
const HIGH_CONSUMPTION_MULTIPLIER = 3;

interface ReadingFormProps {
  subscriber: ReaderSubscriberItem;
  billingMonth: string;
  existingReading: SerializedReadingHistoryItem | null;
  priorReading: SerializedReadingHistoryItem | null;
  submissionFeedback: SubmissionFeedback | null;
  onSubmitted: (
    subscriptionId: string,
    reading: SerializedReadingHistoryItem,
    feedback: SubmissionFeedback,
  ) => void;
}

function resolveEffectivePreviousValue(priorReading: SerializedReadingHistoryItem | null): string | null {
  if (!priorReading) return null;
  if (
    (priorReading.status === "RESOLVED" || priorReading.status === "BASELINE") &&
    priorReading.approvedValue !== null
  ) {
    return priorReading.approvedValue;
  }
  return priorReading.submittedValue;
}

function getPreviewState(
  rawInput: string,
  previousValue: number | null,
  highThresholdKwh: number,
): { previewStatus: PreviewStatus; consumption: number | null } {
  const trimmed = rawInput.trim();
  if (trimmed === "") {
    return { previewStatus: "empty", consumption: null };
  }

  if (!READING_VALUE_PATTERN.test(trimmed)) {
    return { previewStatus: "invalid", consumption: null };
  }

  const numericValue = Number(trimmed);
  if (
    !Number.isFinite(numericValue) ||
    numericValue < 0 ||
    previousValue === null ||
    !Number.isFinite(previousValue)
  ) {
    return { previewStatus: "invalid", consumption: null };
  }

  const consumption = Number((numericValue - previousValue).toFixed(3));
  if (consumption < 0) {
    return { previewStatus: "lower-reading", consumption };
  }
  if (consumption === 0) {
    return { previewStatus: "no-consumption", consumption: 0 };
  }
  if (consumption > highThresholdKwh) {
    return { previewStatus: "high-consumption", consumption };
  }

  return { previewStatus: "accepted", consumption };
}

function getExistingReadingHeading(status: SerializedReadingHistoryItem["status"]): {
  title: string;
  subtitle: string;
  flagged: boolean;
} {
  switch (status) {
    case "FLAGGED":
      return {
        title: "Reading Submitted for Review",
        subtitle: "This reading was flagged for Operator verification before billing.",
        flagged: true,
      };
    case "RESOLVED":
      return {
        title: "Reading Resolved",
        subtitle: "This reading was reviewed and resolved by the Operator.",
        flagged: false,
      };
    case "BASELINE":
      return {
        title: "Baseline Reading Recorded",
        subtitle: "Initial baseline cumulative reading for this subscription.",
        flagged: false,
      };
    case "ACCEPTED":
      return {
        title: "Reading Accepted",
        subtitle: "This monthly reading has been validated and saved.",
        flagged: false,
      };
  }
}

export default function ReadingForm({
  subscriber,
  billingMonth,
  existingReading,
  priorReading,
  submissionFeedback,
  onSubmitted,
}: ReadingFormProps) {
  const [currentReading, setCurrentReading] = useState("");
  const [isPreviewDismissed, setIsPreviewDismissed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<SubmissionFeedback | null>(null);

  const previousValueStr = resolveEffectivePreviousValue(priorReading);
  const previousValueNum = previousValueStr !== null ? Number(previousValueStr) : null;

  const priorConsumptionNum =
    priorReading?.consumptionKwh !== null && priorReading?.consumptionKwh !== undefined
      ? Number(priorReading.consumptionKwh)
      : NaN;
  const highThresholdKwh =
    Number.isFinite(priorConsumptionNum) && priorConsumptionNum > 0
      ? Number((priorConsumptionNum * HIGH_CONSUMPTION_MULTIPLIER).toFixed(3))
      : DEFAULT_BASELINE_THRESHOLD_KWH;

  if (existingReading) {
    const heading = getExistingReadingHeading(existingReading.status);

    return (
      <div className="space-y-4">
        {submissionFeedback && <ReadingFeedbackBanner feedback={submissionFeedback} />}

        <div className="reader-submitted-reading">
          <div
            className={`reader-submitted-reading__icon ${
              heading.flagged
                ? "!bg-[var(--color-warning-bg)] !text-[var(--color-warning)]"
                : ""
            }`}
          >
            {heading.flagged ? <AlertTriangle size={23} /> : <CheckCircle2 size={23} />}
          </div>

          <div className="reader-submitted-reading__content">
            <h4>{heading.title}</h4>
            <p>{heading.subtitle}</p>
          </div>

          <ReadingStatusBadge status={existingReading.status} />

          <div className="reader-submitted-reading__details">
            <div>
              <span>Billing month</span>
              <strong>{formatBillingMonth(existingReading.billingMonth)}</strong>
            </div>

            <div>
              <span>Previous reading</span>
              <strong>
                {existingReading.previousReadingValue !== null
                  ? `${formatKwh(existingReading.previousReadingValue)} kWh`
                  : "—"}
              </strong>
            </div>

            <div>
              <span>Submitted reading</span>
              <strong>{formatKwh(existingReading.submittedValue)} kWh</strong>
            </div>

            <div>
              <span>Recorded consumption</span>
              <strong>
                {existingReading.consumptionKwh !== null
                  ? `${formatKwh(existingReading.consumptionKwh)} kWh`
                  : "Pending review"}
              </strong>
            </div>

            {existingReading.approvedValue !== null && (
              <div>
                <span>Approved value</span>
                <strong>{formatKwh(existingReading.approvedValue)} kWh</strong>
              </div>
            )}
          </div>

          {existingReading.flagReason && (
            <div className="w-full">
              <Alert
                variant="warning"
                title="Flag reason"
                message={existingReading.flagReason}
              />
            </div>
          )}

          {existingReading.reviewNote && (
            <div className="w-full">
              <Alert
                variant="info"
                title="Operator review note"
                message={existingReading.reviewNote}
              />
            </div>
          )}

          <p className="reader-submitted-reading__note">
            A reading is already recorded for {formatBillingMonth(billingMonth)}. Select another
            subscriber or billing month to enter a new reading.
          </p>
        </div>
      </div>
    );
  }

  if (!priorReading || previousValueStr === null) {
    return (
      <div className="space-y-4">
        <div className="reader-subscriber-info grid grid-cols-2 gap-3">
          <div className="min-w-0 rounded-lg bg-[var(--color-surface-secondary)] p-3 sm:p-4">
            <p className="text-xs leading-5 text-[var(--color-text-secondary)]">Subscription</p>
            <p className="mt-2 text-xl font-semibold text-[var(--color-text)] sm:text-2xl">
              {subscriber.amperage}A
            </p>
          </div>

          <div className="min-w-0 rounded-lg bg-[var(--color-surface-secondary)] p-3 sm:p-4">
            <p className="text-xs leading-5 text-[var(--color-text-secondary)]">Previous Reading</p>
            <p className="mt-2 text-xl font-semibold text-[var(--color-text)] sm:text-2xl">—</p>
          </div>
        </div>

        <Alert
          variant="warning"
          title="Baseline reading required"
          message={`No cumulative reading exists before ${formatBillingMonth(
            billingMonth,
          )}. Ask the Operator to record an initial baseline reading before submitting monthly consumption.`}
        />
      </div>
    );
  }

  if (priorReading.status === "FLAGGED") {
    return (
      <div className="space-y-4">
        <div className="reader-subscriber-info grid grid-cols-2 gap-3">
          <div className="min-w-0 rounded-lg bg-[var(--color-surface-secondary)] p-3 sm:p-4">
            <p className="text-xs leading-5 text-[var(--color-text-secondary)]">Subscription</p>
            <p className="mt-2 text-xl font-semibold text-[var(--color-text)] sm:text-2xl">
              {subscriber.amperage}A
            </p>
          </div>

          <div className="min-w-0 rounded-lg bg-[var(--color-surface-secondary)] p-3 sm:p-4">
            <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
              Prior Reading ({formatBillingMonth(priorReading.billingMonth)})
            </p>
            <p className="mt-2 break-words text-xl font-semibold text-[var(--color-text)] sm:text-2xl">
              {formatKwh(priorReading.submittedValue)} kWh
            </p>
          </div>
        </div>

        <Alert
          variant="warning"
          title="Previous reading awaiting review"
          message={`The ${formatBillingMonth(
            priorReading.billingMonth,
          )} reading is currently FLAGGED and must be resolved by the Operator before submitting ${formatBillingMonth(
            billingMonth,
          )}.`}
        />
      </div>
    );
  }

  const { previewStatus, consumption } = getPreviewState(
    currentReading,
    previousValueNum,
    highThresholdKwh,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmed = currentReading.trim();
    if (trimmed === "" || previewStatus === "invalid") {
      setErrorFeedback({
        variant: "danger",
        message: "Please enter a valid non-negative meter reading (up to 3 decimal places).",
      });
      return;
    }

    setIsSubmitting(true);
    setErrorFeedback(null);

    try {
      const response = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: subscriber.subscriptionId,
          billingMonth,
          submittedValue: trimmed,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: Record<string, unknown>;
            error?: { code?: string; message?: string };
          }
        | null;

      if (!response.ok || !payload?.success || !payload.data) {
        const message =
          payload?.error?.message ??
          (response.status === 401
            ? "Your session expired. Please sign in again."
            : "Unable to submit meter reading. Please try again.");

        setErrorFeedback({
          variant: response.status === 409 ? "warning" : "danger",
          title:
            response.status === 409
              ? "Reading submission blocked"
              : "Submission failed",
          message,
        });
        return;
      }

      const saved = normalizeApiReading(payload.data);
      const feedback: SubmissionFeedback =
        saved.status === "FLAGGED"
          ? {
              variant: "warning",
              title: "Submitted for Operator review",
              message: saved.flagReason
                ? `${saved.flagReason} Original value (${formatKwh(
                    saved.submittedValue,
                  )} kWh) was preserved.`
                : `Reading was flagged for review. Original value (${formatKwh(
                    saved.submittedValue,
                  )} kWh) was preserved.`,
            }
          : {
              variant: "success",
              title: "Reading submitted",
              message: `Accepted for ${formatBillingMonth(saved.billingMonth)}${
                saved.consumptionKwh !== null
                  ? ` (${formatKwh(saved.consumptionKwh)} kWh consumption)`
                  : ""
              }.`,
            };

      onSubmitted(subscriber.subscriptionId, saved, feedback);
    } catch {
      setErrorFeedback({
        variant: "danger",
        title: "Network error",
        message: "Could not reach the server. Check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Subscriber metadata */}
      <div className="reader-subscriber-info grid grid-cols-2 gap-3">
        <div className="min-w-0 rounded-lg bg-[var(--color-surface-secondary)] p-3 sm:p-4">
          <p className="text-xs leading-5 text-[var(--color-text-secondary)]">Subscription</p>
          <p className="mt-2 text-xl font-semibold text-[var(--color-text)] sm:text-2xl">
            {subscriber.amperage}A
          </p>
        </div>

        <div className="min-w-0 rounded-lg bg-[var(--color-surface-secondary)] p-3 sm:p-4">
          <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
            Previous ({formatBillingMonth(priorReading.billingMonth)})
          </p>
          <p className="mt-2 break-words text-xl font-semibold text-[var(--color-text)] sm:text-2xl">
            {formatKwh(previousValueStr)} kWh
          </p>
        </div>
      </div>

      {/* Live validation preview */}
      {previewStatus !== "empty" && !isPreviewDismissed && (
        <ReadingValidationBanner
          status={previewStatus}
          consumptionPreview={consumption}
          highThresholdKwh={highThresholdKwh}
          onDismiss={() => setIsPreviewDismissed(true)}
        />
      )}

      {/* Numeric meter reading input */}
      <div className="reader-reading-field__input">
        <label htmlFor="current-reading" className="wp-label">
          Current Meter Reading (kWh) — {formatBillingMonth(billingMonth)}
        </label>

        <input
          id="current-reading"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          required
          value={currentReading}
          onChange={(event) => {
            setCurrentReading(event.target.value);
            setIsPreviewDismissed(false);
            setErrorFeedback(null);
          }}
          placeholder="Enter cumulative meter reading"
          aria-invalid={previewStatus !== "empty" && previewStatus !== "accepted"}
          className="wp-input w-full px-3.5"
        />
      </div>

      {/* Live consumption calculation */}
      <div className="reader-consumption-summary rounded-lg border p-4">
        <p className="text-sm font-medium">Calculated Consumption</p>

        <p className="mt-2 break-words text-2xl font-bold sm:text-3xl">
          {consumption !== null ? `${formatKwh(consumption)} kWh` : "—"}
        </p>

        <p className="mt-1 text-xs">
          {consumption !== null && consumption < 0
            ? "Lower than previous — will be saved with pending consumption for Operator review"
            : `Current reading − Previous reading (${formatKwh(previousValueStr)} kWh)`}
        </p>
      </div>

      {errorFeedback && <ReadingFeedbackBanner feedback={errorFeedback} />}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={isSubmitting}
        disabled={isSubmitting || !currentReading.trim() || previewStatus === "invalid"}
      >
        Submit Reading
      </Button>
    </form>
  );
}
