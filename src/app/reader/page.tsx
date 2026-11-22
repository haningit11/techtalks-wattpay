"use client";


import { useEffect, useState, type FormEvent } from "react";
import {
  MapPin,
  Users,
  Gauge,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  MinusCircle,
  Info,
  X,
  Clock3,
} from "lucide-react";

import "@/styles/reader.css";

import Button from "@/ui/components/actions/Button";
import Avatar from "@/ui/components/data-display/Avatar";
import Alert from "@/ui/components/feedback/Alert";

import {
  Card,
  CardHeader,
  CardContent,
} from "@/ui/components/containers/Card";

/* =========================================================
   TYPES
========================================================= */

type Subscriber = {
  id: string;
  name: string;
  address: string;
  amperage: number;
  previousReading: number;
  routeId: string;
};

type ReadingStatus =
  | "accepted"
  | "no-consumption"
  | "lower-reading"
  | "high-consumption"
  | "invalid"
  | "empty";

type SubmittedReadingStatus = "ACCEPTED" | "FLAGGED";

type ReadingRecord = {
  subscriberId: string;
  submittedValue: number;
  consumption: number;
  status: SubmittedReadingStatus;
};

type CreateMeterReadingPayload = {
  subscriberId: string;
  routeId: string;
  submittedValue: number;
};

/*
  BACKEND INTEGRATION:

  The frontend will eventually send:

  {
    subscriberId,
    routeId,
    submittedValue
  }

  The backend must validate the reading and determine
  whether it is ACCEPTED or FLAGGED.

  The frontend must not decide the final database status.
*/

/* =========================================================
   TEMPORARY DEMO DATA
========================================================= */

const HIGH_CONSUMPTION_THRESHOLD = 500;

const routes = [
  { id: "RT-001", name: "Downtown Route", area: "Central District" },
  { id: "RT-002", name: "North Residential", area: "North District" },
  { id: "RT-003", name: "East Village", area: "East District" },
];

const subscribers: Subscriber[] = [
  {
    id: "SUB-001",
    name: "Ahmad Hassan",
    address: "Building A, Floor 2",
    amperage: 10,
    previousReading: 1250,
    routeId: "RT-001",
  },
  {
    id: "SUB-002",
    name: "Maya Khalil",
    address: "Building A, Floor 3",
    amperage: 15,
    previousReading: 890,
    routeId: "RT-001",
  },
  {
    id: "SUB-003",
    name: "Omar Nasser",
    address: "Building B, Floor 1",
    amperage: 10,
    previousReading: 1640,
    routeId: "RT-001",
  },
  {
    id: "SUB-004",
    name: "Lina Saleh",
    address: "Building C, Floor 4",
    amperage: 20,
    previousReading: 2100,
    routeId: "RT-002",
  },
  {
    id: "SUB-005",
    name: "Karim Fares",
    address: "Building D, Floor 1",
    amperage: 10,
    previousReading: 760,
    routeId: "RT-002",
  },
  {
    id: "SUB-006",
    name: "Nour Ibrahim",
    address: "Building E, Floor 2",
    amperage: 15,
    previousReading: 1320,
    routeId: "RT-003",
  },
];

/* =========================================================
   PAGE
========================================================= */

export default function ReaderPage() {
  const [selectedRoute, setSelectedRoute] = useState("RT-001");

  const [selectedSubscriberId, setSelectedSubscriberId] =
    useState("SUB-001");

  // Temporary input only. It is NOT a submitted reading.
  const [currentReading, setCurrentReading] = useState("");

  // Controls when the validation popup appears.
  const [hasFinishedReading, setHasFinishedReading] = useState(false);

  const [isValidationPopupDismissed, setIsValidationPopupDismissed] =
    useState(false);

  const [search, setSearch] = useState("");

  const [message, setMessage] = useState("");

  const [messageType, setMessageType] = useState<
    "success" | "warning" | "error" | ""
  >("");

  // Only this state contains submitted readings.
  const [submittedReadings, setSubmittedReadings] = useState<
    Record<string, ReadingRecord>
  >({});

  /* =========================================================
     SELECTED DATA
  ========================================================= */

  const routeSubscribers = subscribers.filter(
    (subscriber) => subscriber.routeId === selectedRoute
  );

  const selectedSubscriber = subscribers.find(
    (subscriber) => subscriber.id === selectedSubscriberId
  );

  const selectedReading = submittedReadings[selectedSubscriberId];

  const filteredSubscribers = routeSubscribers.filter((subscriber) =>
    `${subscriber.name} ${subscriber.address} ${subscriber.id}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const currentValue =
    currentReading.trim() === "" ? null : Number(currentReading);

  const isInvalid =
    currentValue !== null &&
    (!Number.isFinite(currentValue) || currentValue < 0);

  const consumption =
    currentValue !== null &&
    !isInvalid &&
    selectedSubscriber
      ? currentValue - selectedSubscriber.previousReading
      : null;

  /* =========================================================
     READING VALIDATION
  ========================================================= */

  function getReadingStatus(): ReadingStatus {
    if (currentReading.trim() === "") return "empty";

    if (
      currentValue === null ||
      !Number.isFinite(currentValue) ||
      currentValue < 0
    ) {
      return "invalid";
    }

    if (!selectedSubscriber) return "invalid";

    if (currentValue === selectedSubscriber.previousReading) {
      return "no-consumption";
    }

    if (currentValue < selectedSubscriber.previousReading) {
      return "lower-reading";
    }

    if (
      currentValue - selectedSubscriber.previousReading >=
      HIGH_CONSUMPTION_THRESHOLD
    ) {
      return "high-consumption";
    }

    return "accepted";
  }

  const readingStatus = getReadingStatus();
  // Show validation popup shortly after the reader finishes typing.
// This only triggers the popup; it does NOT submit or save anything.
useEffect(() => {
  if (currentReading.trim() === "") {
    setHasFinishedReading(false);
    return;
  }

  const timeout = setTimeout(() => {
    setHasFinishedReading(true);
  }, 400);

  return () => clearTimeout(timeout);
}, [currentReading]);

  /* =========================================================
     SUBSCRIBER VISIT STATUS

     IMPORTANT:
     A subscriber becomes Done or Needs Review ONLY
     after a reading is successfully submitted.
  ========================================================= */

  function getSubscriberVisitStatus(subscriberId: string) {
    const reading = submittedReadings[subscriberId];

    if (!reading) return "not-visited";

    if (reading.status === "ACCEPTED") return "done";

    return "needs-review";
  }

  const completedCount = routeSubscribers.filter(
    (subscriber) =>
      getSubscriberVisitStatus(subscriber.id) === "done"
  ).length;

  const reviewCount = routeSubscribers.filter(
    (subscriber) =>
      getSubscriberVisitStatus(subscriber.id) === "needs-review"
  ).length;

  const remainingCount =
    routeSubscribers.length - completedCount - reviewCount;

  /* =========================================================
     EVENT HANDLERS
  ========================================================= */

  function resetReadingForm() {
    setCurrentReading("");
    setHasFinishedReading(false);
    setMessage("");
    setMessageType("");
    setIsValidationPopupDismissed(false);
  }

  function handleRouteChange(routeId: string) {
    const firstSubscriber = subscribers.find(
      (subscriber) => subscriber.routeId === routeId
    );

    setSelectedRoute(routeId);
    setSelectedSubscriberId(firstSubscriber?.id ?? "");
    setSearch("");
    resetReadingForm();
  }

  function handleSubscriberChange(subscriberId: string) {
    setSelectedSubscriberId(subscriberId);
    resetReadingForm();
  }

 function handleReadingChange(value: string) {
  setCurrentReading(value);

  // Hide the previous popup while the reader is editing.
  // The useEffect will show the updated validation after 400ms.
  setHasFinishedReading(false);
  setIsValidationPopupDismissed(false);

  setMessage("");
  setMessageType("");
}

  /*
    This is the ONLY function that submits a reading.

    Typing, blurring the input, and calculating consumption
    never create a submitted record.
  */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSubscriber) return;

    // Validate only after the user clicks Submit.
    setHasFinishedReading(true);
    setIsValidationPopupDismissed(false);
    setMessage("");
    setMessageType("");

    if (
      currentValue === null ||
      !Number.isFinite(currentValue) ||
      currentValue < 0 ||
      readingStatus === "invalid" ||
      readingStatus === "empty"
    ) {
      setMessage("Please enter a valid, non-negative meter reading.");
      setMessageType("error");
      return;
    }

    // Prevent duplicate submissions for this demo cycle.
    if (submittedReadings[selectedSubscriber.id]) {
      setMessage(
        "A reading has already been submitted for this subscriber."
      );
      setMessageType("warning");
      return;
    }

    // Backend-ready payload.
    const payload: CreateMeterReadingPayload = {
      subscriberId: selectedSubscriber.id,
      routeId: selectedSubscriber.routeId,
      submittedValue: currentValue,
    };

    /*
      DEMO ONLY:

      In the real application, send payload to the API.
      The backend will validate and return the final status.
    */
    const demoStatus: SubmittedReadingStatus =
      readingStatus === "accepted" ? "ACCEPTED" : "FLAGGED";

    const demoRecord: ReadingRecord = {
      subscriberId: payload.subscriberId,
      submittedValue: payload.submittedValue,
      consumption:
        payload.submittedValue - selectedSubscriber.previousReading,
      status: demoStatus,
    };

    // This is where the reading actually becomes submitted.
    setSubmittedReadings((previous) => ({
      ...previous,
      [selectedSubscriber.id]: demoRecord,
    }));

    if (demoStatus === "ACCEPTED") {
      setMessage("Reading submitted successfully.");
      setMessageType("success");
    } else {
      setMessage(
        "Reading submitted for administrator review. The original value is preserved."
      );
      setMessageType("warning");
    }
  }

  /* =========================================================
     VALIDATION MESSAGES
  ========================================================= */

  const alertDetails = {
    accepted: {
      title: "Reading Accepted",
      description:
        "The current reading is higher than the previous reading and does not trigger the configured warning rules.",
      instruction:
        "This reading is ready to submit. It will not be recorded until you click Submit Reading.",
      icon: CheckCircle2,
      label: "ACCEPTED",
    },

    "no-consumption": {
      title: "No Consumption Detected",
      description:
        "The current reading is exactly the same as the previous reading. This means zero consumption has been recorded.",
      instruction:
        "You can submit this reading for administrator review.",
      icon: MinusCircle,
      label: "ZERO CONSUMPTION",
    },

    "lower-reading": {
      title: "Reading Is Lower Than Previous",
      description:
        "The current value is lower than the previous recorded value. This may indicate a typing mistake or an unusual meter situation.",
      instruction:
        "You can submit it for administrator review. The original value must be preserved.",
      icon: AlertTriangle,
      label: "REQUIRES REVIEW",
    },

    "high-consumption": {
      title: "Unusually High Consumption",
      description: `The calculated consumption is ${consumption?.toLocaleString()} units, which reaches the temporary demo threshold of ${HIGH_CONSUMPTION_THRESHOLD.toLocaleString()} units.`,
      instruction:
        "You can submit this reading for administrator review.",
      icon: TrendingUp,
      label: "HIGH CONSUMPTION",
    },

    invalid: {
      title: "Invalid Meter Reading",
      description:
        "The value entered is negative or invalid. Meter readings must be valid, non-negative numbers.",
      instruction:
        "Correct the input before submitting. This reading cannot be submitted.",
      icon: XCircle,
      label: "INVALID INPUT",
    },

    empty: {
      title: "Waiting for Meter Reading",
      description:
        "Enter the subscriber's current meter value to see the validation result.",
      instruction:
        "Check the physical meter and enter its current reading.",
      icon: Info,
      label: "AWAITING INPUT",
    },
  }[readingStatus];

  const AlertIcon = alertDetails.icon;

  /* =========================================================
     VISIT STATUS BADGE
  ========================================================= */

  function VisitStatus({ subscriberId }: { subscriberId: string }) {
    const status = getSubscriberVisitStatus(subscriberId);

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

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="reader-page min-h-screen w-full overflow-x-hidden bg-[var(--color-background)]">

      {/* Header */}
      <header className="sticky top-0 z-20 flex min-h-[var(--header-height)] items-center justify-between border-b border-[var(--color-border)] bg-white px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-[var(--color-text)] sm:text-lg">
            Meter Reader Workspace
          </h1>

          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            WattPay
          </p>
        </div>

        <div className="ml-3 flex shrink-0 items-center gap-3 sm:gap-4">
          <span className="reader-online-indicator">
            <span className="reader-online-indicator__dot" />
            <span>Online</span>
          </span>

          <Avatar name="Meter Reader" size="sm" />
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-[1440px] space-y-6 p-4 sm:space-y-8 sm:p-6 lg:p-8">

        {/* Page heading */}
        <section>
          <h2 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
            Meter Readings
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base">
            Select an assigned route, choose a subscriber, and record their
            current meter reading.
          </p>
        </section>

        {/* Assigned routes */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <MapPin
              size={20}
              className="shrink-0 text-[var(--color-primary)]"
            />

            <h3 className="text-lg font-semibold text-[var(--color-text)]">
              Assigned Routes
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {routes.map((route) => {
              const active = selectedRoute === route.id;

              const routeSubscriberList = subscribers.filter(
                (subscriber) => subscriber.routeId === route.id
              );

              const routeCompleted = routeSubscriberList.filter(
                (subscriber) =>
                  getSubscriberVisitStatus(subscriber.id) === "done"
              ).length;

              const routeReview = routeSubscriberList.filter(
                (subscriber) =>
                  getSubscriberVisitStatus(subscriber.id) === "needs-review"
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

                    {active && (
                      <CheckCircle2
                        size={19}
                        className="text-[var(--color-teal)]"
                      />
                    )}
                  </div>

                  <p className="mt-4 break-words font-semibold text-[var(--color-text)]">
                    {route.name}
                  </p>

                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {route.area}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    <span>{routeSubscriberList.length} subscribers</span>
                    <span className="text-[var(--color-success)]">
                      {routeCompleted} done
                    </span>
                    {routeReview > 0 && (
                      <span className="text-[var(--color-warning)]">
                        {routeReview} review
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Route progress */}
        <section className="reader-route-progress">
          <div className="reader-route-progress__heading">
            <div>
              <p className="reader-route-progress__title">
                Route progress
              </p>
              <p className="reader-route-progress__subtitle">
                {completedCount + reviewCount} of {routeSubscribers.length} subscribers submitted
              </p>
            </div>

            <span className="reader-route-progress__count">
              {routeSubscribers.length > 0
                ? Math.round(
                    ((completedCount + reviewCount) /
                      routeSubscribers.length) *
                      100
                  )
                : 0}
              %
            </span>
          </div>

          <div
            className="reader-route-progress__track"
            role="progressbar"
            aria-label="Route submission progress"
            aria-valuemin={0}
            aria-valuemax={routeSubscribers.length}
            aria-valuenow={completedCount + reviewCount}
          >
            <div
              className="reader-route-progress__fill"
              style={{
                width: `${
                  routeSubscribers.length > 0
                    ? ((completedCount + reviewCount) /
                        routeSubscribers.length) *
                      100
                    : 0
                }%`,
              }}
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

        {/* Subscribers and reading form */}
        <section className="grid min-w-0 grid-cols-1 items-start gap-5 lg:gap-6 xl:grid-cols-2">

          {/* Subscriber list */}
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users
                  size={20}
                  className="shrink-0 text-[var(--color-primary)]"
                />

                <h3 className="font-semibold text-[var(--color-text)]">
                  Subscribers
                </h3>

                <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                  {routeSubscribers.length} total
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
                  filteredSubscribers.map((subscriber) => {
                    const active =
                      selectedSubscriberId === subscriber.id;

                    return (
                      <button
                        key={subscriber.id}
                        type="button"
                        onClick={() =>
                          handleSubscriberChange(subscriber.id)
                        }
                        aria-pressed={active}
                        className={`flex min-h-[82px] w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[var(--color-surface-secondary)] sm:p-5 ${
                          active ? "bg-teal-50/60" : "bg-white"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={subscriber.name} size="md" />

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                              {subscriber.name}
                            </p>

                            <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
                              {subscriber.address}
                            </p>

                            <div className="mt-2">
                              <VisitStatus subscriberId={subscriber.id} />
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-[var(--color-text)]">
                            {subscriber.amperage}A
                          </p>

                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            Amperage
                          </p>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
                    No subscribers found.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Meter reading form */}
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gauge
                  size={20}
                  className="shrink-0 text-[var(--color-primary)]"
                />

                <h3 className="font-semibold text-[var(--color-text)]">
                  Enter Meter Reading
                </h3>
              </div>
            </CardHeader>

            <CardContent>
              {selectedSubscriber ? (
                <div className="space-y-5">

                  {/* Selected subscriber */}
                  <div className="flex items-center gap-3 rounded-lg bg-[var(--color-surface-secondary)] p-3">
                    <Avatar name={selectedSubscriber.name} size="md" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                        {selectedSubscriber.name}
                      </p>

                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {selectedSubscriber.id} · {selectedSubscriber.address}
                      </p>
                    </div>

                    <VisitStatus subscriberId={selectedSubscriber.id} />
                  </div>

                  {/* Submitted reading */}
                  {selectedReading ? (
                    <div className="reader-submitted-reading">
                      <div className="reader-submitted-reading__icon">
                        {selectedReading.status === "ACCEPTED" ? (
                          <CheckCircle2 size={23} />
                        ) : (
                          <AlertTriangle size={23} />
                        )}
                      </div>

                      <div className="reader-submitted-reading__content">
                        <h4>
                          {selectedReading.status === "ACCEPTED"
                            ? "Reading Completed"
                            : "Reading Submitted for Review"}
                        </h4>

                        <p>
                          This reading has been submitted successfully.
                        </p>
                      </div>

                      <span
                        className={`reader-submitted-reading__badge ${
                          selectedReading.status === "ACCEPTED"
                            ? "reader-submitted-reading__badge--done"
                            : "reader-submitted-reading__badge--review"
                        }`}
                      >
                        {selectedReading.status}
                      </span>

                      <div className="reader-submitted-reading__details">
                        <div>
                          <span>Submitted reading</span>
                          <strong>
                            {selectedReading.submittedValue.toLocaleString()}
                          </strong>
                        </div>

                        <div>
                          <span>Recorded consumption</span>
                          <strong>
                            {selectedReading.consumption.toLocaleString()}
                          </strong>
                        </div>
                      </div>

                      <p className="reader-submitted-reading__note">
                        This reading is already submitted for this demo cycle.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">

                      {/* Subscriber information */}
                      <div className="reader-subscriber-info grid grid-cols-2 gap-3">
                        <div className="min-w-0 rounded-lg bg-[var(--color-surface-secondary)] p-3 sm:p-4">
                          <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
                            Subscription
                          </p>

                          <p className="mt-2 text-xl font-semibold text-[var(--color-text)] sm:text-2xl">
                            {selectedSubscriber.amperage}A
                          </p>
                        </div>

                        <div className="min-w-0 rounded-lg bg-[var(--color-surface-secondary)] p-3 sm:p-4">
                          <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
                            Previous Reading
                          </p>

                          <p className="mt-2 break-words text-xl font-semibold text-[var(--color-text)] sm:text-2xl">
                            {selectedSubscriber.previousReading.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Validation popup */}
                      {hasFinishedReading &&
                        currentReading.trim() !== "" &&
                        !isValidationPopupDismissed && (
                          <div
                            className={`reader-validation-popup reader-validation-popup--${readingStatus}`}
                            role="alert"
                            aria-live="assertive"
                          >
                            <div className="reader-validation-popup__icon">
                              <AlertIcon size={22} />
                            </div>

                            <div className="reader-validation-popup__content">
                              <span className="reader-validation-popup__label">
                                {alertDetails.label}
                              </span>

                              <h4>{alertDetails.title}</h4>

                              <p>{alertDetails.description}</p>

                              <div className="reader-validation-popup__instruction">
                                {alertDetails.instruction}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="reader-validation-popup__close"
                              onClick={() =>
                                setIsValidationPopupDismissed(true)
                              }
                              aria-label="Close notification"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        )}

                      {/* Current reading */}
                      <div className="reader-reading-field__input">
                        <label
                          htmlFor="current-reading"
                          className="wp-label"
                        >
                          Current Meter Reading
                        </label>

                        <input
  id="current-reading"
  type="number"
  min="0"
  step="any"
  inputMode="decimal"
  required
  value={currentReading}
  onChange={(event) =>
    handleReadingChange(event.target.value)
  }
  placeholder="Enter current reading"
  aria-invalid={
    hasFinishedReading &&
    (
      readingStatus === "invalid" ||
      readingStatus === "lower-reading" ||
      readingStatus === "no-consumption" ||
      readingStatus === "high-consumption"
    )
  }
  className="wp-input w-full"
/>
                      </div>

                      {/* Live calculation only — no submission */}
                      <div className="reader-consumption-summary rounded-lg border p-4">
                        <p className="text-sm font-medium">
                          Calculated Consumption
                        </p>

                        <p className="mt-2 break-words text-2xl font-bold sm:text-3xl">
                          {consumption !== null
                            ? consumption.toLocaleString()
                            : "—"}
                        </p>

                        <p className="mt-1 text-xs">
                          Current reading − Previous reading
                        </p>
                      </div>

                      {/* Submission feedback */}
                      {message && (
                        <Alert
                          message={message}
                          variant={
                            messageType === "warning"
                              ? "warning"
                              : messageType === "success"
                                ? "success"
                                : "danger"
                          }
                        />
                      )}

                      {/* Submit */}
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        fullWidth
                        disabled={
                          !currentReading.trim() ||
                          readingStatus === "invalid" ||
                          !selectedSubscriber
                        }
                      >
                        Submit Reading
                      </Button>
                    </form>
                  )}
                </div>
              ) : (
                <p className="rounded-lg bg-[var(--color-surface-secondary)] p-4 text-sm text-[var(--color-text-secondary)]">
                  No subscribers are available in this route.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}