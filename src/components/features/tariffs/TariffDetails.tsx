"use client";

import Modal from "./TariffModal";
import { Card, CardContent } from "@/ui/components/containers/Card";
import StatusBadge from "@/ui/components/feedback/StatusBadge";
import { decimalLabel, monthLabel, type Tariff } from "./tariff-client";

type Props = { tariff: Tariff; onClose: () => void };

export default function TariffDetails({ tariff, onClose }: Props) {
  const fields = [
    ["Billing month", monthLabel(tariff.billingMonth)], ["Amperage", `${tariff.amperage} A`],
    ["Rate per kWh", `$${decimalLabel(tariff.ratePerKwh, 2)}`], ["Fixed monthly fee", `$${decimalLabel(tariff.fixedFee, 2)}`],
    ["Currency", tariff.currency], ["Created", new Date(tariff.createdAt).toLocaleString()],
    ["Last updated", new Date(tariff.updatedAt).toLocaleString()],
  ];
  return <Modal onClose={onClose} title="Tariff details" size="lg">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-[var(--color-text-secondary)]">Monthly pricing plan</p><h3 className="mt-1 text-xl">{tariff.name}</h3></div><StatusBadge status={tariff.isActive ? "active" : "inactive"} /></div>
    <Card><CardContent><dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-[var(--color-text)]">{value}</dd></div>)}</dl></CardContent></Card>
  </Modal>;
}
