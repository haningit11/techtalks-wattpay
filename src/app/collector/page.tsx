
"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Search,
  Users,
  Wallet,
  Receipt,
  CheckCircle2,
  Clock3,
  CreditCard,
  ArrowDownLeft,
  FileText,
  MapPin,
  UserCheck,
  UserX,
  Route as RouteIcon,
} from "lucide-react";

import "@/styles/collector.css";

import Avatar from "@/ui/components/data-display/Avatar";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/ui/components/containers/Card";

import Button from "@/ui/components/actions/Button";
import Input from "@/ui/components/forms/Input";
import Alert from "@/ui/components/feedback/Alert";
import StatusBadge from "@/ui/components/feedback/StatusBadge";
import EmptyState from "@/ui/components/feedback/EmptyState";
import Modal from "@/ui/components/overlays/Modal";

/* =========================================================
   TYPES
========================================================= */

type Route = {
  id: string;
  name: string;
  district: string;
  subscriberIds: string[];
};

type Subscriber = {
  id: string;
  name: string;
  address: string;
  phone: string;
  amperage: number;
  routeId: string;
};

type Bill = {
  id: string;
  subscriberId: string;
  period: string;
  issueDate: string;
  dueDate: string;
  total: number;
  paid: number;
};

type Payment = {
  id: string;
  subscriberId: string;
  billId: string;
  amount: number;
  date: string;
  method: "Cash" | "Other";
};

type PaymentMethod = "Cash" | "Other";
type VisitStatus = "VISITED" | "NOT_VISITED";
type SubscriberFilter = "all" | "not-visited" | "outstanding";

/* =========================================================
   TEMPORARY DEMO DATA

   Replace this data with backend responses later.
========================================================= */

const routes: Route[] = [
  {
    id: "RT-001",
    name: "Downtown Route",
    district: "Central District",
    subscriberIds: ["SUB-001", "SUB-002"],
  },
  {
    id: "RT-002",
    name: "North Route",
    district: "North District",
    subscriberIds: ["SUB-003", "SUB-004"],
  },
];

const subscribers: Subscriber[] = [
  {
    id: "SUB-001",
    name: "Ahmad Hassan",
    address: "Building A, Floor 2",
    phone: "03 123 456",
    amperage: 10,
    routeId: "RT-001",
  },
  {
    id: "SUB-002",
    name: "Maya Khalil",
    address: "Building A, Floor 3",
    phone: "70 234 567",
    amperage: 15,
    routeId: "RT-001",
  },
  {
    id: "SUB-003",
    name: "Omar Nasser",
    address: "Building B, Floor 1",
    phone: "71 345 678",
    amperage: 10,
    routeId: "RT-002",
  },
  {
    id: "SUB-004",
    name: "Lina Saleh",
    address: "Building C, Floor 4",
    phone: "76 456 789",
    amperage: 20,
    routeId: "RT-002",
  },
];

const initialBills: Bill[] = [
  {
    id: "BILL-2026-001",
    subscriberId: "SUB-001",
    period: "October 2026",
    issueDate: "2026-11-01",
    dueDate: "2026-11-15",
    total: 50,
    paid: 20,
  },
  {
    id: "BILL-2026-002",
    subscriberId: "SUB-001",
    period: "November 2026",
    issueDate: "2026-11-20",
    dueDate: "2026-12-05",
    total: 65,
    paid: 0,
  },
  {
    id: "BILL-2026-003",
    subscriberId: "SUB-002",
    period: "November 2026",
    issueDate: "2026-11-20",
    dueDate: "2026-12-05",
    total: 75,
    paid: 75,
  },
  {
    id: "BILL-2026-004",
    subscriberId: "SUB-003",
    period: "October 2026",
    issueDate: "2026-11-01",
    dueDate: "2026-11-15",
    total: 45,
    paid: 0,
  },
  {
    id: "BILL-2026-005",
    subscriberId: "SUB-004",
    period: "November 2026",
    issueDate: "2026-11-20",
    dueDate: "2026-12-05",
    total: 90,
    paid: 40,
  },
];

const initialPayments: Payment[] = [
  {
    id: "PAY-001",
    subscriberId: "SUB-001",
    billId: "BILL-2026-001",
    amount: 20,
    date: "2026-11-10",
    method: "Cash",
  },
  {
    id: "PAY-002",
    subscriberId: "SUB-002",
    billId: "BILL-2026-003",
    amount: 75,
    date: "2026-11-21",
    method: "Cash",
  },
  {
    id: "PAY-003",
    subscriberId: "SUB-004",
    billId: "BILL-2026-005",
    amount: 40,
    date: "2026-11-21",
    method: "Cash",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getBillBalance(bill: Bill) {
  return Math.max(bill.total - bill.paid, 0);
}

function getBillStatus(bill: Bill) {
  const balance = getBillBalance(bill);

  if (balance === 0) return "PAID";
  if (bill.paid > 0) return "PARTIALLY_PAID";

  return "UNPAID";
}

function getSubscriberCollectionStatus(
  subscriberId: string,
  bills: Bill[]
) {
  const subscriberBills = bills.filter(
    (bill) => bill.subscriberId === subscriberId
  );

  if (subscriberBills.length === 0) {
    return "NOT_COLLECTED";
  }

  const totalBilled = subscriberBills.reduce(
    (total, bill) => total + bill.total,
    0
  );

  const totalPaid = subscriberBills.reduce(
    (total, bill) => total + bill.paid,
    0
  );

  if (totalPaid === 0) return "NOT_COLLECTED";
  if (totalPaid >= totalBilled) return "COLLECTED";

  return "PARTIALLY_COLLECTED";
}

function getSubscriberTotals(subscriberId: string, bills: Bill[]) {
  const subscriberBills = bills.filter(
    (bill) => bill.subscriberId === subscriberId
  );

  return {
    billed: subscriberBills.reduce(
      (total, bill) => total + bill.total,
      0
    ),
    collected: subscriberBills.reduce(
      (total, bill) => total + bill.paid,
      0
    ),
    outstanding: subscriberBills.reduce(
      (total, bill) => total + getBillBalance(bill),
      0
    ),
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function CollectorPage() {
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);

  const [selectedRouteId, setSelectedRouteId] = useState("RT-001");
  const [selectedSubscriberId, setSelectedSubscriberId] =
    useState("SUB-001");

  const [selectedBillId, setSelectedBillId] =
    useState("BILL-2026-001");

  const [visitStatuses, setVisitStatuses] = useState<
    Record<string, VisitStatus>
  >({
    "SUB-001": "VISITED",
    "SUB-002": "NOT_VISITED",
    "SUB-003": "NOT_VISITED",
    "SUB-004": "VISITED",
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SubscriberFilter>("all");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("Cash");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");

  const [receiptPayment, setReceiptPayment] =
    useState<Payment | null>(null);

  /* =========================================================
     SELECTED DATA
  ========================================================= */

  const selectedRoute = routes.find(
    (route) => route.id === selectedRouteId
  );

  const selectedSubscriber = subscribers.find(
    (subscriber) => subscriber.id === selectedSubscriberId
  );

  const selectedBill = bills.find(
    (bill) =>
      bill.id === selectedBillId &&
      bill.subscriberId === selectedSubscriberId
  );

  const routeSubscribers = subscribers.filter(
    (subscriber) => subscriber.routeId === selectedRouteId
  );

  const subscriberBills = bills.filter(
    (bill) => bill.subscriberId === selectedSubscriberId
  );

  const subscriberPayments = payments
    .filter(
      (payment) => payment.subscriberId === selectedSubscriberId
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  /* =========================================================
     ROUTE STATISTICS
  ========================================================= */

  const routeSubscriberIds = routeSubscribers.map(
    (subscriber) => subscriber.id
  );

  const routeBills = bills.filter((bill) =>
    routeSubscriberIds.includes(bill.subscriberId)
  );

  const routeBilled = routeBills.reduce(
    (total, bill) => total + bill.total,
    0
  );

  const routeCollected = routeBills.reduce(
    (total, bill) => total + bill.paid,
    0
  );

  const routeOutstanding = routeBills.reduce(
    (total, bill) => total + getBillBalance(bill),
    0
  );

  const visitedCount = routeSubscribers.filter(
    (subscriber) =>
      visitStatuses[subscriber.id] === "VISITED"
  ).length;

  const notVisitedCount =
    routeSubscribers.length - visitedCount;

  const collectionProgress =
    routeBilled > 0
      ? Math.min((routeCollected / routeBilled) * 100, 100)
      : 0;

  /* =========================================================
     GLOBAL STATISTICS
  ========================================================= */

  const totalOutstanding = bills.reduce(
    (total, bill) => total + getBillBalance(bill),
    0
  );

  const totalCollected = payments.reduce(
    (total, payment) => total + payment.amount,
    0
  );

  const today = getTodayDate();

  const collectedToday = payments
    .filter((payment) => payment.date === today)
    .reduce((total, payment) => total + payment.amount, 0);

  /* =========================================================
     FILTERED SUBSCRIBERS
  ========================================================= */

  const filteredSubscribers = useMemo(() => {
    return subscribers.filter((subscriber) => {
      if (subscriber.routeId !== selectedRouteId) {
        return false;
      }

      const matchesSearch = `${subscriber.name} ${subscriber.id} ${subscriber.address}`
        .toLowerCase()
        .includes(search.toLowerCase());

      const balance = bills
        .filter((bill) => bill.subscriberId === subscriber.id)
        .reduce(
          (total, bill) => total + getBillBalance(bill),
          0
        );

      const visitStatus = visitStatuses[subscriber.id];

      const matchesFilter =
        filter === "all" ||
        (filter === "not-visited" &&
          visitStatus === "NOT_VISITED") ||
        (filter === "outstanding" && balance > 0);

      return matchesSearch && matchesFilter;
    });
  }, [selectedRouteId, search, filter, bills, visitStatuses]);

  /* =========================================================
     SELECTED SUBSCRIBER TOTALS
  ========================================================= */

  const selectedSubscriberTotals = selectedSubscriber
    ? getSubscriberTotals(selectedSubscriber.id, bills)
    : { billed: 0, collected: 0, outstanding: 0 };

  const selectedBillBalance = selectedBill
    ? getBillBalance(selectedBill)
    : 0;

  const numericPayment = Number(paymentAmount);

  const paymentIsValid =
    paymentAmount.trim() !== "" &&
    Number.isFinite(numericPayment) &&
    numericPayment > 0 &&
    numericPayment <= selectedBillBalance;

  /* =========================================================
     EVENT HANDLERS
  ========================================================= */

  function clearPaymentFeedback() {
    setMessage("");
    setMessageType("");
    setReceiptPayment(null);
  }

  function handleRouteChange(routeId: string) {
    const nextRoute = routes.find((route) => route.id === routeId);

    if (!nextRoute) return;

    const firstSubscriber = subscribers.find(
      (subscriber) => subscriber.routeId === routeId
    );

    const nextBills = firstSubscriber
      ? bills.filter(
          (bill) => bill.subscriberId === firstSubscriber.id
        )
      : [];

    const firstUnpaidBill = nextBills.find(
      (bill) => getBillBalance(bill) > 0
    );

    setSelectedRouteId(routeId);
    setSelectedSubscriberId(firstSubscriber?.id ?? "");
    setSelectedBillId(
      firstUnpaidBill?.id ?? nextBills[0]?.id ?? ""
    );

    setSearch("");
    setFilter("all");
    setPaymentAmount("");
    clearPaymentFeedback();
  }

  function handleSubscriberChange(subscriberId: string) {
    const nextSubscriberBills = bills.filter(
      (bill) => bill.subscriberId === subscriberId
    );

    const firstUnpaidBill = nextSubscriberBills.find(
      (bill) => getBillBalance(bill) > 0
    );

    setSelectedSubscriberId(subscriberId);
    setSelectedBillId(
      firstUnpaidBill?.id ?? nextSubscriberBills[0]?.id ?? ""
    );

    setPaymentAmount("");
    clearPaymentFeedback();
  }

  function handleBillChange(billId: string) {
    setSelectedBillId(billId);
    setPaymentAmount("");
    clearPaymentFeedback();
  }

  function handleVisitStatusChange(subscriberId: string) {
    setVisitStatuses((previous) => ({
      ...previous,
      [subscriberId]:
        previous[subscriberId] === "VISITED"
          ? "NOT_VISITED"
          : "VISITED",
    }));
  }

  function handleRecordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSubscriber || !selectedBill) return;

    const amount = Number(paymentAmount);
    const remainingBalance = getBillBalance(selectedBill);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a payment amount greater than zero.");
      setMessageType("error");
      return;
    }

    if (amount > remainingBalance) {
      setMessage(
        `Payment cannot exceed the remaining balance of ${formatMoney(
          remainingBalance
        )}.`
      );
      setMessageType("error");
      return;
    }

    const newPayment: Payment = {
      id: `PAY-${Date.now()}`,
      subscriberId: selectedSubscriber.id,
      billId: selectedBill.id,
      amount,
      date: getTodayDate(),
      method: paymentMethod,
    };

    // DEMO ONLY:
    // The real application should save this payment through the backend.
    // The backend must validate the amount and preserve payment records.

    setPayments((previous) => [newPayment, ...previous]);

    setBills((previous) =>
      previous.map((bill) =>
        bill.id === selectedBill.id
          ? { ...bill, paid: bill.paid + amount }
          : bill
      )
    );

    setPaymentAmount("");
    setMessage("Payment recorded successfully.");
    setMessageType("success");
    setReceiptPayment(newPayment);
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="collector-page min-h-screen w-full overflow-x-hidden">

      {/* HEADER */}
      <header className="sticky top-0 z-20 flex min-h-[var(--header-height)] items-center justify-between border-b border-[var(--color-border)] bg-white px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-[var(--color-text)] sm:text-lg">
            Payment Collector Workspace
          </h1>

          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            WattPay
          </p>
        </div>

        <div className="ml-3 flex shrink-0 items-center gap-3 sm:gap-4">
          <span className="collector-online-indicator">
            <span className="collector-online-indicator__dot" />
            Online
          </span>

          <Avatar name="Payment Collector" size="sm" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] space-y-6 p-4 sm:space-y-8 sm:p-6 lg:p-8">

        {/* PAGE HEADING */}
        <section>
          <h2 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
            Payment Collection
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base">
            Select a route, track subscriber visits, and manage collected payments.
          </p>
        </section>

        {/* GLOBAL SUMMARY */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 sm:gap-4">

          <Card className="collector-stat-card">
            <CardContent>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Total Outstanding
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                    {formatMoney(totalOutstanding)}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                    Remaining across all routes
                  </p>
                </div>

                <span className="collector-stat-icon collector-stat-icon--warning">
                  <Wallet size={21} />
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="collector-stat-card">
            <CardContent>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Total Collected
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                    {formatMoney(totalCollected)}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                    Recorded payments
                  </p>
                </div>

                <span className="collector-stat-icon collector-stat-icon--success">
                  <ArrowDownLeft size={21} />
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="collector-stat-card sm:col-span-2 xl:col-span-1">
            <CardContent>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Collected Today
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                    {formatMoney(collectedToday)}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                    Payments recorded today
                  </p>
                </div>

                <span className="collector-stat-icon collector-stat-icon--info">
                  <Receipt size={21} />
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ROUTE SELECTION */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">
                My Collection Routes
              </h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Select a route to view its subscribers and collection progress.
              </p>
            </div>

            <span className="text-xs text-[var(--color-text-muted)]">
              {routes.length} assigned routes
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {routes.map((route) => {
              const active = selectedRouteId === route.id;

              const routeSubscriberCount = route.subscriberIds.length;

              const routeVisitCount = route.subscriberIds.filter(
                (id) => visitStatuses[id] === "VISITED"
              ).length;

              const routeOutstanding = bills
                .filter((bill) =>
                  route.subscriberIds.includes(bill.subscriberId)
                )
                .reduce(
                  (total, bill) => total + getBillBalance(bill),
                  0
                );

              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => handleRouteChange(route.id)}
                  aria-pressed={active}
                  className={`collector-route-card ${
                    active ? "collector-route-card--active" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="collector-route-icon">
                      <RouteIcon size={21} />
                    </span>

                    {active && (
                      <span className="collector-route-selected">
                        <CheckCircle2 size={15} />
                        Selected
                      </span>
                    )}
                  </div>

                  <div className="mt-4 text-left">
                    <p className="font-semibold text-[var(--color-text)]">
                      {route.name}
                    </p>

                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                      <MapPin size={13} />
                      {route.district}
                    </p>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="text-left">
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Subscribers
                      </p>
                      <p className="mt-1 text-lg font-bold text-[var(--color-text)]">
                        {routeSubscriberCount}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Visited
                      </p>
                      <p className="mt-1 text-lg font-bold text-[var(--color-teal)]">
                        {routeVisitCount}/{routeSubscriberCount}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Outstanding
                      </p>
                      <p className="mt-1 text-sm font-bold text-[var(--color-warning)]">
                        {formatMoney(routeOutstanding)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* SELECTED ROUTE OVERVIEW */}
        {selectedRoute && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-teal)]">
                  Selected route
                </p>
                <h3 className="mt-1 text-xl font-bold text-[var(--color-text)]">
                  {selectedRoute.name}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {selectedRoute.district}
                </p>
              </div>

              <span className="rounded-full bg-[var(--color-teal-light)] px-3 py-1.5 text-xs font-semibold text-[var(--color-teal)]">
                {routeSubscribers.length} subscribers
              </span>
            </div>

            {/* Route statistics */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

              <Card>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <UserCheck size={17} className="text-[var(--color-success)]" />
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Visited
                    </p>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-[var(--color-success)]">
                    {visitedCount}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <UserX size={17} className="text-[var(--color-warning)]" />
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Not visited
                    </p>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-[var(--color-warning)]">
                    {notVisitedCount}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Wallet size={17} className="text-[var(--color-danger)]" />
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Outstanding
                    </p>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-[var(--color-text)]">
                    {formatMoney(routeOutstanding)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Route collection progress */}
            <Card>
              <CardContent>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">
                      Route Collection Progress
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      Collected amount compared with total billed amount
                    </p>
                  </div>

                  <span className="text-xl font-bold text-[var(--color-teal)]">
                    {collectionProgress.toFixed(1)}%
                  </span>
                </div>

                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--color-surface-secondary)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-teal)] transition-all duration-300"
                    style={{ width: `${collectionProgress}%` }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Total billed
                    </p>
                    <p className="mt-1 font-semibold text-[var(--color-text)]">
                      {formatMoney(routeBilled)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Collected
                    </p>
                    <p className="mt-1 font-semibold text-[var(--color-success)]">
                      {formatMoney(routeCollected)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Remaining
                    </p>
                    <p className="mt-1 font-semibold text-[var(--color-warning)]">
                      {formatMoney(routeOutstanding)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* MAIN WORKSPACE */}
        <section className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[0.9fr_1.1fr] xl:gap-6">

          {/* SUBSCRIBERS IN SELECTED ROUTE */}
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users
                  size={20}
                  className="shrink-0 text-[var(--color-primary)]"
                />

                <h3 className="font-semibold text-[var(--color-text)]">
                  Route Subscribers
                </h3>

                <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                  {filteredSubscribers.length} shown
                </span>
              </div>

              <div className="mt-4">
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search this route..."
                  aria-label="Search subscribers in selected route"
                  leftIcon={<Search size={17} />}
                  containerClassName="collector-search"
                />
              </div>

              <div className="collector-filter-row mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant={filter === "all" ? "teal" : "secondary"}
                  onClick={() => setFilter("all")}
                >
                  All
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant={filter === "not-visited" ? "teal" : "secondary"}
                  onClick={() => setFilter("not-visited")}
                >
                  Not visited
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant={filter === "outstanding" ? "teal" : "secondary"}
                  onClick={() => setFilter("outstanding")}
                >
                  Outstanding
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="divide-y divide-[var(--color-border)]">
                {filteredSubscribers.length > 0 ? (
                  filteredSubscribers.map((subscriber) => {
                    const active =
                      selectedSubscriberId === subscriber.id;

                    const totals = getSubscriberTotals(
                      subscriber.id,
                      bills
                    );

                    const visitStatus =
                      visitStatuses[subscriber.id] ?? "NOT_VISITED";

                    const collectionStatus =
                      getSubscriberCollectionStatus(
                        subscriber.id,
                        bills
                      );

                    return (
                      <button
                        key={subscriber.id}
                        type="button"
                        onClick={() =>
                          handleSubscriberChange(subscriber.id)
                        }
                        aria-pressed={active}
                        className={`collector-subscriber-row ${
                          active
                            ? "collector-subscriber-row--active"
                            : ""
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={subscriber.name} size="md" />

                          <div className="min-w-0 text-left">
                            <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                              {subscriber.name}
                            </p>

                            <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
                              {subscriber.id} · {subscriber.address}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <StatusBadge
                                status={
                                  visitStatus === "VISITED"
                                    ? "ACTIVE"
                                    : "PENDING"
                                }
                                label={
                                  visitStatus === "VISITED"
                                    ? "Visited"
                                    : "Not visited"
                                }
                              />

                              <StatusBadge
                                status={
                                  collectionStatus === "COLLECTED"
                                    ? "PAID"
                                    : collectionStatus === "PARTIALLY_COLLECTED"
                                      ? "PARTIALLY_PAID"
                                      : "UNPAID"
                                }
                                label={
                                  collectionStatus === "COLLECTED"
                                    ? "Collected"
                                    : collectionStatus === "PARTIALLY_COLLECTED"
                                      ? "Partially collected"
                                      : "Not collected"
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-[var(--color-text)]">
                            {formatMoney(totals.outstanding)}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            Outstanding
                          </p>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <EmptyState
                    title="No subscribers found"
                    description="Try another search or filter in this route."
                    icon={<Users size={25} />}
                    className="py-8"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* SUBSCRIBER DETAILS */}
          <div className="min-w-0 space-y-5">
            {selectedSubscriber ? (
              <>
                {/* SUBSCRIBER ACCOUNT */}
                <Card className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <FileText
                        size={20}
                        className="text-[var(--color-primary)]"
                      />
                      <h3 className="font-semibold text-[var(--color-text)]">
                        Subscriber Account
                      </h3>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar
                        name={selectedSubscriber.name}
                        size="lg"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--color-text)]">
                          {selectedSubscriber.name}
                        </p>

                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {selectedSubscriber.id} · {selectedSubscriber.address}
                        </p>

                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {selectedSubscriber.phone}
                        </p>

                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {selectedSubscriber.amperage}A subscription
                        </p>
                      </div>

                      <div className="collector-account-balance">
                        <span>Outstanding balance</span>
                        <strong>
                          {formatMoney(selectedSubscriberTotals.outstanding)}
                        </strong>
                      </div>
                    </div>

                    {/* VISIT STATUS */}
                    <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          Subscriber Visit Status
                        </p>

                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          Track whether this subscriber has been visited.
                        </p>
                      </div>

                      <Button
                        type="button"
                        size="md"
                        variant={
                          visitStatuses[selectedSubscriber.id] === "VISITED"
                            ? "secondary"
                            : "teal"
                        }
                        fullWidth
                        className="mt-3"
                        leftIcon={
                          visitStatuses[selectedSubscriber.id] === "VISITED"
                            ? <UserX size={17} />
                            : <UserCheck size={17} />
                        }
                        onClick={() =>
                          handleVisitStatusChange(selectedSubscriber.id)
                        }
                      >
                        {visitStatuses[selectedSubscriber.id] === "VISITED"
                          ? "Mark as not visited"
                          : "Mark as visited"}
                      </Button>
                    </div>

                    {/* SUBSCRIBER FINANCIAL SUMMARY */}
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          Total Billed
                        </p>

                        <p className="mt-2 text-xl font-bold text-[var(--color-text)]">
                          {formatMoney(selectedSubscriberTotals.billed)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          Total Collected
                        </p>

                        <p className="mt-2 text-xl font-bold text-[var(--color-success)]">
                          {formatMoney(selectedSubscriberTotals.collected)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* SUBSCRIBER BILLS */}
                <Card className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Receipt
                          size={20}
                          className="text-[var(--color-primary)]"
                        />
                        <h3 className="font-semibold text-[var(--color-text)]">
                          Subscriber Bills
                        </h3>
                      </div>

                      <span className="text-xs text-[var(--color-text-muted)]">
                        {subscriberBills.length} bills
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {subscriberBills.length > 0 ? (
                      <div className="space-y-3">
                        {subscriberBills.map((bill) => {
                          const balance = getBillBalance(bill);
                          const isSelected = bill.id === selectedBillId;

                          return (
                            <button
                              key={bill.id}
                              type="button"
                              onClick={() => handleBillChange(bill.id)}
                              aria-pressed={isSelected}
                              className={`collector-bill-row ${
                                isSelected
                                  ? "collector-bill-row--active"
                                  : ""
                              }`}
                            >
                              <div className="flex min-w-0 items-start gap-3">
                                <span className="collector-bill-icon">
                                  <Receipt size={19} />
                                </span>

                                <div className="min-w-0 flex-1 text-left">
                                  <p className="text-sm font-semibold text-[var(--color-text)]">
                                    {bill.period}
                                  </p>

                                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                    {bill.id}
                                  </p>

                                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                                    Due {formatDate(bill.dueDate)}
                                  </p>
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold text-[var(--color-text)]">
                                  {formatMoney(balance)}
                                </p>

                                <StatusBadge
                                  status={getBillStatus(bill)}
                                  label={
                                    balance === 0
                                      ? "Paid"
                                      : bill.paid > 0
                                        ? "Partially paid"
                                        : "Outstanding"
                                  }
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyState
                        title="No bills found"
                        description="There are no bills for this subscriber yet."
                        icon={<Receipt size={24} />}
                        className="py-6"
                      />
                    )}
                  </CardContent>
                </Card>

                {/* RECORD PAYMENT */}
                <Card className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CreditCard
                        size={20}
                        className="text-[var(--color-primary)]"
                      />
                      <h3 className="font-semibold text-[var(--color-text)]">
                        Record Payment
                      </h3>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {selectedBill ? (
                      selectedBillBalance > 0 ? (
                        <form
                          onSubmit={handleRecordPayment}
                          className="space-y-4"
                        >
                          <div className="collector-payment-summary">
                            <div>
                              <span>Selected bill</span>
                              <strong>{selectedBill.period}</strong>
                            </div>

                            <div>
                              <span>Bill total</span>
                              <strong>
                                {formatMoney(selectedBill.total)}
                              </strong>
                            </div>

                            <div>
                              <span>Already paid</span>
                              <strong>
                                {formatMoney(selectedBill.paid)}
                              </strong>
                            </div>

                            <div className="collector-payment-summary__balance">
                              <span>Remaining balance</span>
                              <strong>
                                {formatMoney(selectedBillBalance)}
                              </strong>
                            </div>
                          </div>

                          <Input
                            id="payment-amount"
                            label="Payment Amount"
                            type="number"
                            min="0.01"
                            max={selectedBillBalance}
                            step="0.01"
                            inputMode="decimal"
                            value={paymentAmount}
                            onChange={(event) => {
                              setPaymentAmount(event.target.value);
                              setMessage("");
                              setMessageType("");
                              setReceiptPayment(null);
                            }}
                            placeholder="Enter amount"
                            leftIcon={<span>$</span>}
                            helperText={`Maximum payment: ${formatMoney(
                              selectedBillBalance
                            )}`}
                            required
                          />

                          <div>
                            <label
                              htmlFor="payment-method"
                              className="wp-label"
                            >
                              Payment Method
                            </label>

                            <select
                              id="payment-method"
                              value={paymentMethod}
                              onChange={(event) =>
                                setPaymentMethod(
                                  event.target.value as PaymentMethod
                                )
                              }
                              className="wp-input w-full"
                            >
                              <option value="Cash">Cash</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          {message && (
                            <Alert
                              message={message}
                              variant={
                                messageType === "success"
                                  ? "success"
                                  : "danger"
                              }
                            />
                          )}

                          <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            fullWidth
                            disabled={!paymentIsValid}
                            leftIcon={<CreditCard size={18} />}
                          >
                            Record Payment
                          </Button>

                          <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                            Recording a payment updates the bill balance and
                            the subscriber's collection status.
                          </p>
                        </form>
                      ) : (
                        <div className="collector-paid-state">
                          <CheckCircle2 size={25} />
                          <div>
                            <p className="font-semibold">
                              This bill is fully paid
                            </p>
                            <p className="mt-1 text-xs">
                              There is no remaining balance to collect.
                            </p>
                          </div>
                        </div>
                      )
                    ) : (
                      <EmptyState
                        title="No bill selected"
                        description="Select a bill to record a payment."
                        icon={<Receipt size={24} />}
                        className="py-6"
                      />
                    )}
                  </CardContent>
                </Card>

                {/* PAYMENT HISTORY */}
                <Card className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Clock3
                        size={20}
                        className="text-[var(--color-primary)]"
                      />
                      <h3 className="font-semibold text-[var(--color-text)]">
                        Payment History
                      </h3>

                      <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                        {subscriberPayments.length} records
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {subscriberPayments.length > 0 ? (
                      <div className="divide-y divide-[var(--color-border)]">
                        {subscriberPayments.map((payment) => (
                          <div
                            key={payment.id}
                            className="collector-payment-history-row"
                          >
                            <span className="collector-payment-history-icon">
                              <ArrowDownLeft size={18} />
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[var(--color-text)]">
                                {formatMoney(payment.amount)}
                              </p>

                              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                {payment.id} · {payment.method}
                              </p>

                              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                {formatDate(payment.date)}
                              </p>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setReceiptPayment(payment)}
                            >
                              View receipt
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No payment history"
                        description="No payments have been recorded for this subscriber."
                        icon={<Clock3 size={24} />}
                        className="py-6"
                      />
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent>
                  <EmptyState
                    title="No subscriber selected"
                    description="Select a subscriber from this route to view their account."
                    icon={<Users size={25} />}
                    className="py-10"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </main>

      {/* RECEIPT MODAL */}
      <Modal
        isOpen={!!receiptPayment}
        onClose={() => setReceiptPayment(null)}
        title="Payment Receipt"
        size="md"
        footer={
          <Button
            type="button"
            variant="primary"
            onClick={() => setReceiptPayment(null)}
          >
            Close Receipt
          </Button>
        }
      >
        {receiptPayment && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="collector-receipt-check">
                <CheckCircle2 size={24} />
              </span>

              <div>
                <p className="font-semibold text-[var(--color-text)]">
                  Payment recorded successfully.
                </p>

                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Your payment record is available below.
                </p>
              </div>
            </div>

            <div className="collector-receipt-amount">
              {formatMoney(receiptPayment.amount)}
            </div>

            <div className="collector-receipt-details">
              <div>
                <span>Receipt number</span>
                <strong>{receiptPayment.id}</strong>
              </div>

              <div>
                <span>Subscriber</span>
                <strong>
                  {
                    subscribers.find(
                      (subscriber) =>
                        subscriber.id === receiptPayment.subscriberId
                    )?.name
                  }
                </strong>
              </div>

              <div>
                <span>Bill reference</span>
                <strong>{receiptPayment.billId}</strong>
              </div>

              <div>
                <span>Payment date</span>
                <strong>{formatDate(receiptPayment.date)}</strong>
              </div>

              <div>
                <span>Payment method</span>
                <strong>{receiptPayment.method}</strong>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
