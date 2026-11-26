"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock3,
  Gauge,
  MapPin,
  Search,
  Users,
} from "lucide-react";

import "@/styles/reader.css";

import type {
  ReaderSubscriberItem,
  ReaderWorkspaceData,
  SerializedReadingHistoryItem,
} from "@/server/services/reading.service";
import Avatar from "@/ui/components/data-display/Avatar";
import { Card, CardContent, CardHeader } from "@/ui/components/containers/Card";
import EmptyState from "@/ui/components/feedback/EmptyState";
import ReadingForm from "@/components/features/readings/ReadingForm";
import ReadingHistory from "@/components/features/readings/ReadingHistory";
import {
  formatBillingMonth,
  getReadingVisitStatus,
  normalizeApiReading,
  VisitStatusBadge,
  type SubmissionFeedback,
} from "@/components/features/readings/ReadingStatus";

interface ReaderWorkspaceProps {
  initialData: ReaderWorkspaceData;
  initialBillingMonth: string;
  readerName: string;
}

function findReadingForMonth(
  history: SerializedReadingHistoryItem[],
  billingMonth: string,
): SerializedReadingHistoryItem | null {
  return history.find((item) => item.billingMonth === billingMonth) ?? null;
}

function findPriorReadingForMonth(
  history: SerializedReadingHistoryItem[],
  billingMonth: string,
): SerializedReadingHistoryItem | null {
  return history.find((item) => item.billingMonth < billingMonth) ?? null;
}

function mergeReadingIntoHistory(
  existing: SerializedReadingHistoryItem[],
  added: SerializedReadingHistoryItem,
): SerializedReadingHistoryItem[] {
  const next = [
    added,
    ...existing.filter(
      (item) => item.id !== added.id && item.billingMonth !== added.billingMonth,
    ),
  ];
  return next.sort((a, b) => b.billingMonth.localeCompare(a.billingMonth));
}

export default function ReaderWorkspace({
  initialData,
  initialBillingMonth,
  readerName,
}: ReaderWorkspaceProps) {
  const router = useRouter();
  const [billingMonth, setBillingMonth] = useState(initialBillingMonth);
  const [selectedRouteId, setSelectedRouteId] = useState(
    () => initialData.routes[0]?.id ?? "",
  );
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState(() => {
    const firstRouteId = initialData.routes[0]?.id;
    if (!firstRouteId) return "";
    return (
      initialData.subscribers.find((sub) => sub.routeId === firstRouteId)?.subscriptionId ?? ""
    );
  });
  const [search, setSearch] = useState("");
  const [historyOverrides, setHistoryOverrides] = useState<
    Record<string, SerializedReadingHistoryItem[]>
  >({});
  const [feedbackByKey, setFeedbackByKey] = useState<Record<string, SubmissionFeedback>>({});
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const subscribers: ReaderSubscriberItem[] = useMemo(
    () =>
      initialData.subscribers.map((sub) => ({
        ...sub,
        history: historyOverrides[sub.subscriptionId] ?? sub.history,
      })),
    [initialData.subscribers, historyOverrides],
  );

  const routeSubscribers = useMemo(
    () => subscribers.filter((sub) => sub.routeId === selectedRouteId),
    [subscribers, selectedRouteId],
  );

  const selectedSubscriber =
    routeSubscribers.find((sub) => sub.subscriptionId === selectedSubscriptionId) ??
    routeSubscribers[0] ??
    null;

  const filteredSubscribers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return routeSubscribers;
    return routeSubscribers.filter((sub) =>
      `${sub.subscriberName} ${sub.address} ${sub.subscriptionId}`
        .toLowerCase()
        .includes(query),
    );
  }, [routeSubscribers, search]);

  const completedCount = routeSubscribers.filter(
    (sub) => getReadingVisitStatus(findReadingForMonth(sub.history, billingMonth)) === "done",
  ).length;

  const reviewCount = routeSubscribers.filter(
    (sub) =>
      getReadingVisitStatus(findReadingForMonth(sub.history, billingMonth)) === "needs-review",
  ).length;

  const remainingCount = routeSubscribers.length - completedCount - reviewCount;
  const submittedCount = completedCount + reviewCount;
  const progressPct =
    routeSubscribers.length > 0
      ? Math.round((submittedCount / routeSubscribers.length) * 100)
      : 0;

  const selectedReading = selectedSubscriber
    ? findReadingForMonth(selectedSubscriber.history, billingMonth)
    : null;
  const selectedPriorReading = selectedSubscriber
    ? findPriorReadingForMonth(selectedSubscriber.history, billingMonth)
    : null;
  const selectedVisitStatus = getReadingVisitStatus(selectedReading);
  const activeFeedback = selectedSubscriber
    ? feedbackByKey[`${selectedSubscriber.subscriptionId}:${billingMonth}`] ?? null
    : null;

  function handleRouteChange(routeId: string) {
    const firstSubscriber = subscribers.find((sub) => sub.routeId === routeId);
    setSelectedRouteId(routeId);
    setSelectedSubscriptionId(firstSubscriber?.subscriptionId ?? "");
    setSearch("");
    setRefreshError(null);
  }

  function handleSubscriberChange(subscriptionId: string) {
    setSelectedSubscriptionId(subscriptionId);
    setRefreshError(null);
  }

  function handleReadingSubmitted(
    subscriptionId: string,
    reading: SerializedReadingHistoryItem,
    feedback: SubmissionFeedback,
  ) {
    setHistoryOverrides((previous) => {
      const baseHistory =
        previous[subscriptionId] ??
        initialData.subscribers.find((sub) => sub.subscriptionId === subscriptionId)?.history ??
        [];
      return {
        ...previous,
        [subscriptionId]: mergeReadingIntoHistory(baseHistory, reading),
      };
    });
    setFeedbackByKey((previous) => ({
      ...previous,
      [`${subscriptionId}:${reading.billingMonth}`]: feedback,
    }));
    router.refresh();
  }

  async function handleRefreshHistory() {
    if (!selectedSubscriber || isRefreshingHistory) return;

    const targetSubscriptionId = selectedSubscriber.subscriptionId;
    setIsRefreshingHistory(true);
    setRefreshError(null);

    try {
      const response = await fetch(
        `/api/readings?subscriptionId=${encodeURIComponent(targetSubscriptionId)}`,
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: Array<Record<string, unknown>>;
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.success || !Array.isArray(payload.data)) {
        setRefreshError(
          payload?.error?.message ?? "Unable to refresh reading history right now.",
        );
        return;
      }

      const normalized = payload.data
        .map(normalizeApiReading)
        .sort((a, b) => b.billingMonth.localeCompare(a.billingMonth));

      setHistoryOverrides((previous) => ({
        ...previous,
        [targetSubscriptionId]: normalized,
      }));
    } catch {
      setRefreshError("Could not reach the server to refresh reading history.");
    } finally {
      setIsRefreshingHistory(false);
    }
  }

  return (
    <div className="reader-page min-h-screen w-full overflow-x-hidden bg-[var(--color-background)]">
      {/* Sticky Workspace Header */}
      <header className="sticky top-0 z-20 flex min-h-[var(--header-height)] items-center justify-between border-b border-[var(--color-border)] bg-white px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-[var(--color-text)] sm:text-lg">
            Meter Reader Workspace
          </h1>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">WattPay</p>
        </div>

        <div className="ml-3 flex shrink-0 items-center gap-3 sm:gap-4">
          <span className="reader-online-indicator">
            <span className="reader-online-indicator__dot" />
            <span>Live</span>
          </span>
          <Avatar name={readerName} size="sm" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] space-y-6 p-4 sm:space-y-8 sm:p-6 lg:p-8">
        {/* Section 1: Page heading & Billing Month selector */}
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
              Meter Readings
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base">
              Select an assigned route, choose an active subscriber, and submit their cumulative
              meter reading for {formatBillingMonth(billingMonth)}.
            </p>
          </div>

          <div className="w-full sm:w-56">
            <label htmlFor="reader-billing-month" className="wp-label flex items-center gap-1.5">
              <Calendar size={14} className="text-[var(--color-teal)]" />
              Billing Month
            </label>
            <input
              id="reader-billing-month"
              type="month"
              value={billingMonth}
              onChange={(event) => {
                if (event.target.value) {
                  setBillingMonth(event.target.value);
                  setRefreshError(null);
                }
              }}
              className="wp-input w-full px-3.5"
            />
          </div>
        </section>

        {/* Section 2: Assigned routes */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <MapPin size={20} className="shrink-0 text-[var(--color-primary)]" />
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Assigned Routes</h3>
          </div>

          {initialData.routes.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-white">
              <EmptyState
                icon={<MapPin size={22} />}
                title="No routes assigned"
                description="Ask your Generator Operator to assign you to an active collection route before submitting meter readings."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              {initialData.routes.map((route) => {
                const active = selectedRouteId === route.id;
                const list = subscribers.filter((sub) => sub.routeId === route.id);
                const routeCompleted = list.filter(
                  (sub) =>
                    getReadingVisitStatus(findReadingForMonth(sub.history, billingMonth)) === "done",
                ).length;
                const routeReview = list.filter(
                  (sub) =>
                    getReadingVisitStatus(findReadingForMonth(sub.history, billingMonth)) ===
                    "needs-review",
                ).length;

                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => handleRouteChange(route.id)}
                    aria-pressed={active}
                    className={`min-w-0 rounded-xl border p-4 text-left transition sm:p-5 ${
                      active
                        ? "border-[var(--color-teal)] bg-teal-50/50 ring-1 ring-[var(--color-teal)]"
                        : "border-[var(--color-border)] bg-white hover:border-[var(--color-border-strong)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <MapPin
                        size={20}
                        className={
                          active
                            ? "text-[var(--color-teal)]"
                            : "text-[var(--color-text-secondary)]"
                        }
                      />
                      {active && <CheckCircle2 size={19} className="text-[var(--color-teal)]" />}
                    </div>

                    <p className="mt-4 break-words font-semibold text-[var(--color-text)]">
                      {route.name}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {route.description ?? "Assigned collection route"}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                      <span>{list.length} active</span>
                      <span className="text-[var(--color-success)]">{routeCompleted} done</span>
                      {routeReview > 0 && (
                        <span className="text-[var(--color-warning)]">{routeReview} review</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 3: Route progress */}
        <section className="reader-route-progress">
          <div className="reader-route-progress__heading">
            <div>
              <p className="reader-route-progress__title">
                Route progress ({formatBillingMonth(billingMonth)})
              </p>
              <p className="reader-route-progress__subtitle">
                {submittedCount} of {routeSubscribers.length} active subscriptions submitted
              </p>
            </div>
            <span className="reader-route-progress__count">{progressPct}%</span>
          </div>

          <div
            className="reader-route-progress__track"
            role="progressbar"
            aria-label="Route submission progress"
            aria-valuemin={0}
            aria-valuemax={routeSubscribers.length}
            aria-valuenow={submittedCount}
          >
            <div
              className="reader-route-progress__fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="reader-route-progress__legend">
            <span>
              <CheckCircle2 size={14} />
              {completedCount} done
            </span>
            <span>
              <AlertTriangle size={14} />
              {reviewCount} needs review
            </span>
            <span>
              <Clock3 size={14} />
              {remainingCount} not submitted
            </span>
          </div>
        </section>

        {/* Section 4: Subscribers & Meter Reading Form */}
        <section className="grid min-w-0 grid-cols-1 items-start gap-5 lg:gap-6 xl:grid-cols-2">
          {/* Subscriber list */}
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users size={20} className="shrink-0 text-[var(--color-primary)]" />
                <h3 className="font-semibold text-[var(--color-text)]">Subscribers</h3>
                <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                  {routeSubscribers.length} active
                </span>
              </div>

              <div className="relative mt-4">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search subscribers..."
                  aria-label="Search subscribers"
                  className="wp-input w-full pl-10"
                />
              </div>
            </CardHeader>

            <CardContent>
              <div className="divide-y divide-[var(--color-border)]">
                {filteredSubscribers.length > 0 ? (
                  filteredSubscribers.map((sub) => {
                    const active = selectedSubscriber?.subscriptionId === sub.subscriptionId;
                    const monthReading = findReadingForMonth(sub.history, billingMonth);
                    const visitStatus = getReadingVisitStatus(monthReading);

                    return (
                      <button
                        key={sub.subscriptionId}
                        type="button"
                        onClick={() => handleSubscriberChange(sub.subscriptionId)}
                        aria-pressed={active}
                        className={`flex min-h-[82px] w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[var(--color-surface-secondary)] sm:p-5 ${
                          active ? "bg-teal-50/60" : "bg-white"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={sub.subscriberName} size="md" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                              {sub.subscriberName}
                            </p>
                            <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
                              {sub.address}
                            </p>
                            <div className="mt-2">
                              <VisitStatusBadge status={visitStatus} />
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-[var(--color-text)]">
                            {sub.amperage}A
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Amperage</p>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
                    No subscribers found for this route.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Reading submission card */}
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gauge size={20} className="shrink-0 text-[var(--color-primary)]" />
                <h3 className="font-semibold text-[var(--color-text)]">Enter Meter Reading</h3>
              </div>
            </CardHeader>

            <CardContent>
              {selectedSubscriber ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 rounded-lg bg-[var(--color-surface-secondary)] p-3">
                    <Avatar name={selectedSubscriber.subscriberName} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                        {selectedSubscriber.subscriberName}
                      </p>
                      <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
                        {selectedSubscriber.address}
                      </p>
                    </div>
                    <VisitStatusBadge status={selectedVisitStatus} />
                  </div>

                  <ReadingForm
                    key={`${selectedSubscriber.subscriptionId}:${billingMonth}`}
                    subscriber={selectedSubscriber}
                    billingMonth={billingMonth}
                    existingReading={selectedReading}
                    priorReading={selectedPriorReading}
                    submissionFeedback={activeFeedback}
                    onSubmitted={handleReadingSubmitted}
                  />
                </div>
              ) : (
                <p className="rounded-lg bg-[var(--color-surface-secondary)] p-4 text-sm text-[var(--color-text-secondary)]">
                  No active subscriptions are available in this route.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Section 5: Selected subscriber reading history */}
        {selectedSubscriber && (
          <section>
            <ReadingHistory
              subscriberName={selectedSubscriber.subscriberName}
              address={selectedSubscriber.address}
              history={selectedSubscriber.history}
              selectedBillingMonth={billingMonth}
              isRefreshing={isRefreshingHistory}
              refreshError={refreshError}
              onRefresh={handleRefreshHistory}
            />
          </section>
        )}
      </main>
    </div>
  );
}
