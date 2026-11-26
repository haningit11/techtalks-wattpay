"use client";

import { History, RefreshCw } from "lucide-react";

import type { SerializedReadingHistoryItem } from "@/server/services/reading.service";
import Button from "@/ui/components/actions/Button";
import { Card, CardContent, CardHeader } from "@/ui/components/containers/Card";
import Alert from "@/ui/components/feedback/Alert";
import EmptyState from "@/ui/components/feedback/EmptyState";
import {
  formatBillingMonth,
  formatKwh,
  ReadingStatusBadge,
} from "@/components/features/readings/ReadingStatus";

interface ReadingHistoryProps {
  subscriberName: string;
  address: string;
  history: SerializedReadingHistoryItem[];
  selectedBillingMonth: string;
  isRefreshing: boolean;
  refreshError: string | null;
  onRefresh: () => void;
}

function formatConsumption(item: SerializedReadingHistoryItem): string {
  if (item.consumptionKwh !== null) {
    return `${formatKwh(item.consumptionKwh)} kWh`;
  }
  return item.status === "FLAGGED" ? "Pending review" : "—";
}

function getNotesSummary(item: SerializedReadingHistoryItem): string {
  if (item.reviewNote && item.flagReason) {
    return `${item.flagReason} · Note: ${item.reviewNote}`;
  }
  if (item.reviewNote) return item.reviewNote;
  if (item.flagReason) return item.flagReason;
  return item.status === "BASELINE" ? "Initial baseline" : "—";
}

export default function ReadingHistory({
  subscriberName,
  address,
  history,
  selectedBillingMonth,
  isRefreshing,
  refreshError,
  onRefresh,
}: ReadingHistoryProps) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <History size={20} className="shrink-0 text-[var(--color-primary)]" />
          <div className="min-w-0">
            <h3 className="font-semibold text-[var(--color-text)]">Reading History</h3>
            <p className="truncate text-xs text-[var(--color-text-secondary)]">
              {subscriberName} · {address}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-muted)]">
            {history.length} {history.length === 1 ? "record" : "records"}
          </span>

          <Button
            variant="secondary"
            size="sm"
            loading={isRefreshing}
            leftIcon={<RefreshCw size={14} />}
            onClick={onRefresh}
          >
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {refreshError && <Alert variant="danger" message={refreshError} />}

        {history.length === 0 ? (
          <EmptyState
            icon={<History size={22} />}
            title="No readings recorded yet"
            description="Submitted and baseline meter readings for this subscription will appear here."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    <th className="px-4 py-3">Billing Month</th>
                    <th className="px-4 py-3">Previous</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Approved</th>
                    <th className="px-4 py-3">Consumption</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {history.map((item) => {
                    const isSelectedMonth = item.billingMonth === selectedBillingMonth;
                    return (
                      <tr
                        key={item.id}
                        className={
                          isSelectedMonth
                            ? "bg-teal-50/40"
                            : "hover:bg-[var(--color-surface-secondary)]"
                        }
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-[var(--color-text)]">
                          {formatBillingMonth(item.billingMonth)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[var(--color-text-secondary)]">
                          {item.previousReadingValue !== null
                            ? `${formatKwh(item.previousReadingValue)} kWh`
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-[var(--color-text)]">
                          {formatKwh(item.submittedValue)} kWh
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[var(--color-text)]">
                          {item.approvedValue !== null
                            ? `${formatKwh(item.approvedValue)} kWh`
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[var(--color-text)]">
                          {formatConsumption(item)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <ReadingStatusBadge status={item.status} />
                        </td>
                        <td className="max-w-xs px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                          {getNotesSummary(item)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="space-y-3 md:hidden">
              {history.map((item) => {
                const isSelectedMonth = item.billingMonth === selectedBillingMonth;
                const notes = getNotesSummary(item);
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 ${
                      isSelectedMonth
                        ? "border-[var(--color-teal)] bg-teal-50/30"
                        : "border-[var(--color-border)] bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        {formatBillingMonth(item.billingMonth)}
                      </p>
                      <ReadingStatusBadge status={item.status} />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="block text-[var(--color-text-muted)]">Previous</span>
                        <strong className="font-medium text-[var(--color-text)]">
                          {item.previousReadingValue !== null
                            ? `${formatKwh(item.previousReadingValue)} kWh`
                            : "—"}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[var(--color-text-muted)]">Submitted</span>
                        <strong className="font-semibold text-[var(--color-text)]">
                          {formatKwh(item.submittedValue)} kWh
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[var(--color-text-muted)]">Consumption</span>
                        <strong className="font-medium text-[var(--color-text)]">
                          {formatConsumption(item)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[var(--color-text-muted)]">Approved</span>
                        <strong className="font-medium text-[var(--color-text)]">
                          {item.approvedValue !== null
                            ? `${formatKwh(item.approvedValue)} kWh`
                            : "—"}
                        </strong>
                      </div>
                    </div>

                    {notes !== "—" && (
                      <p className="mt-3 border-t border-[var(--color-border)] pt-2.5 text-xs text-[var(--color-text-secondary)]">
                        {notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
