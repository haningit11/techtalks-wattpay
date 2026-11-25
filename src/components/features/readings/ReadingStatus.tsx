"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Info,
  MinusCircle,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";

import type { SerializedReadingHistoryItem } from "@/server/services/reading.service";
import Alert from "@/ui/components/feedback/Alert";
import StatusBadge from "@/ui/components/feedback/StatusBadge";

export type ReadingStatusValue = SerializedReadingHistoryItem["status"];

export type PreviewStatus =
  | "empty"
  | "invalid"
  | "accepted"
  | "no-consumption"
  | "lower-reading"
  | "high-consumption";

export type VisitStatus = "done" | "needs-review" | "not-visited";

export interface SubmissionFeedback {
  variant: "success" | "warning" | "danger";
  title?: string;
  message: string;
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const READING_STATUS_LABELS: Record<ReadingStatusValue, string> = {
  ACCEPTED: "Accepted",
  FLAGGED: "Flagged",
  RESOLVED: "Resolved",
  BASELINE: "Baseline",
};

function toDecimalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function normalizeApiReading(raw: Record<string, unknown>): SerializedReadingHistoryItem {
  const billingMonthRaw = String(raw.billingMonth ?? "");
  const createdAtRaw = String(raw.createdAt ?? new Date().toISOString());
  const rawStatus = String(raw.status ?? "ACCEPTED");
  const status: ReadingStatusValue =
    rawStatus === "BASELINE" ||
    rawStatus === "ACCEPTED" ||
    rawStatus === "FLAGGED" ||
    rawStatus === "RESOLVED"
      ? rawStatus
      : "ACCEPTED";

  return {
    id: String(raw.id ?? ""),
    billingMonth: billingMonthRaw.slice(0, 7),
    previousReadingValue: toDecimalString(raw.previousReadingValue),
    submittedValue: toDecimalString(raw.submittedValue) ?? "0",
    approvedValue: toDecimalString(raw.approvedValue),
    consumptionKwh: toDecimalString(raw.consumptionKwh),
    status,
    flagReason: typeof raw.flagReason === "string" ? raw.flagReason : null,
    reviewNote: typeof raw.reviewNote === "string" ? raw.reviewNote : null,
    createdAt: createdAtRaw,
  };
}

export function formatKwh(value: string | number): string {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return String(value);
  }
  return parsed.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

export function formatBillingMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!match) return month;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return month;
  return MONTH_FORMATTER.format(new Date(Date.UTC(year, monthIndex, 1)));
}

export function getReadingVisitStatus(
  reading: SerializedReadingHistoryItem | null,
): VisitStatus {
  if (!reading) return "not-visited";
  if (reading.status === "FLAGGED") return "needs-review";
  return "done";
}

export function ReadingStatusBadge({
  status,
  className,
}: {
  status: ReadingStatusValue;
  className?: string;
}) {
  return (
    <StatusBadge
      status={status}
      label={READING_STATUS_LABELS[status]}
      className={className}
    />
  );
}

export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  if (status === "done") {
    return (
      <span className="reader-visit-status reader-visit-status--done">
        <CheckCircle2 size={13} />
        Done
      </span>
    );
  }

  if (status === "needs-review") {
    return (
      <span className="reader-visit-status reader-visit-status--review">
        <AlertTriangle size={13} />
        Needs review
      </span>
    );
  }

  return (
    <span className="reader-visit-status reader-visit-status--pending">
      <Clock3 size={13} />
      Not visited
    </span>
  );
}

function PreviewBannerIcon({ status }: { status: PreviewStatus }) {
  switch (status) {
    case "accepted":
      return <CheckCircle2 size={22} />;
    case "no-consumption":
      return <MinusCircle size={22} />;
    case "lower-reading":
      return <AlertTriangle size={22} />;
    case "high-consumption":
      return <TrendingUp size={22} />;
    case "invalid":
      return <XCircle size={22} />;
    case "empty":
      return <Info size={22} />;
  }
}

function getPreviewCopy(
  status: Exclude<PreviewStatus, "empty">,
  consumptionPreview: number | null,
  highThresholdKwh: number,
): { label: string; title: string; description: string; instruction: string } {
  switch (status) {
    case "accepted":
      return {
        label: "READY TO SUBMIT",
        title: "Valid Meter Reading",
        description:
          "This cumulative reading is higher than the previous reading and within the expected consumption range.",
        instruction:
          "Click Submit Reading to record this reading for the selected billing month.",
      };
    case "no-consumption":
      return {
        label: "ZERO CONSUMPTION",
        title: "No Consumption Detected",
        description:
          "The entered reading equals the previous cumulative reading (0 kWh).",
        instruction:
          "You can still submit it. It will be flagged for Operator review.",
      };
    case "lower-reading":
      return {
        label: "REQUIRES REVIEW",
        title: "Reading Is Lower Than Previous",
        description:
          "The entered value is lower than the previous cumulative reading.",
        instruction:
          "You can submit it for Operator review. Your original submitted value will be preserved.",
      };
    case "high-consumption":
      return {
        label: "HIGH CONSUMPTION",
        title: "Unusually High Consumption",
        description: `Calculated consumption is ${
          consumptionPreview !== null ? formatKwh(consumptionPreview) : "—"
        } kWh, exceeding the preview threshold of ${formatKwh(highThresholdKwh)} kWh.`,
        instruction:
          "You can submit it for Operator review.",
      };
    case "invalid":
      return {
        label: "INVALID INPUT",
        title: "Invalid Meter Reading",
        description:
          "Enter a valid non-negative number with up to 3 decimal places (max 9 integer digits).",
        instruction:
          "Correct the value before submitting.",
      };
  }
}

export function ReadingValidationBanner({
  status,
  consumptionPreview,
  highThresholdKwh,
  onDismiss,
}: {
  status: PreviewStatus;
  consumptionPreview: number | null;
  highThresholdKwh: number;
  onDismiss: () => void;
}) {
  if (status === "empty") return null;

  const copy = getPreviewCopy(status, consumptionPreview, highThresholdKwh);

  return (
    <div
      className={`reader-validation-popup reader-validation-popup--${status}`}
      role="alert"
      aria-live="polite"
    >
      <div className="reader-validation-popup__icon">
        <PreviewBannerIcon status={status} />
      </div>

      <div className="reader-validation-popup__content">
        <span className="reader-validation-popup__label">{copy.label}</span>
        <h4>{copy.title}</h4>
        <p>{copy.description}</p>
        <div className="reader-validation-popup__instruction">{copy.instruction}</div>
      </div>

      <button
        type="button"
        className="reader-validation-popup__close"
        onClick={onDismiss}
        aria-label="Dismiss validation notification"
      >
        <X size={18} />
      </button>
    </div>
  );
}

export function ReadingFeedbackBanner({
  feedback,
  icon,
}: {
  feedback: SubmissionFeedback;
  icon?: ReactNode;
}) {
  return (
    <Alert
      variant={feedback.variant}
      title={feedback.title}
      message={feedback.message}
      icon={icon}
    />
  );
}
