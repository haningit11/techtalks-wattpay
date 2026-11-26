"use client";

import { Eye, Pencil, Power } from "lucide-react";
import Table, { type TableColumn } from "@/ui/components/data-display/Table";
import Button from "@/ui/components/actions/Button";
import StatusBadge from "@/ui/components/feedback/StatusBadge";
import { decimalLabel, monthLabel, type Tariff } from "./tariff-client";

type Props = { tariffs: Tariff[]; onView: (tariff: Tariff) => void; onEdit: (tariff: Tariff) => void; onToggleStatus: (tariff: Tariff) => void };

export default function TariffTable({ tariffs, onView, onEdit, onToggleStatus }: Props) {
  const columns: TableColumn<Tariff>[] = [
    { key: "name", header: "Tariff", render: (_, row) => <span className="font-semibold text-[var(--color-primary)]">{row.name}</span> },
    { key: "billingMonth", header: "Billing month", render: (_, row) => monthLabel(row.billingMonth) },
    { key: "amperage", header: "Amperage", render: (_, row) => `${row.amperage} A` },
    { key: "ratePerKwh", header: "Rate / kWh", render: (_, row) => `$${decimalLabel(row.ratePerKwh, 2)}` },
    { key: "fixedFee", header: "Monthly fee", render: (_, row) => `$${decimalLabel(row.fixedFee, 2)}` },
    { key: "currency", header: "Currency" },
    { key: "isActive", header: "Status", render: (_, row) => <StatusBadge status={row.isActive ? "active" : "inactive"} /> },
    { key: "id", header: "Actions", render: (_, row) => <div className="flex items-center gap-1"><Button variant="ghost" size="sm" onClick={() => onView(row)} aria-label={`View ${row.name}`} leftIcon={<Eye size={15} />}>View</Button><Button variant="ghost" size="sm" onClick={() => onEdit(row)} aria-label={`Edit ${row.name}`} leftIcon={<Pencil size={15} />}>Edit</Button><Button variant="ghost" size="sm" onClick={() => onToggleStatus(row)} aria-label={`${row.isActive ? "Deactivate" : "Activate"} ${row.name}`} leftIcon={<Power size={15} />}>{row.isActive ? "Deactivate" : "Activate"}</Button></div> },
  ];
  return <Table columns={columns} data={tariffs} rowKey="id" />;
}
