
type StatusBadgeProps = {
  status: string;
  label?: string;
  className?: string;
};

const statusStyles: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  ACCEPTED: "bg-green-100 text-green-800",
  ACTIVE: "bg-green-100 text-green-800",
  RESOLVED: "bg-green-100 text-green-800",

  UNPAID: "bg-red-100 text-red-800",
  OVERDUE: "bg-red-100 text-red-800",
  INACTIVE: "bg-slate-100 text-slate-700",

  PARTIALLY_PAID: "bg-amber-100 text-amber-800",
  PENDING: "bg-amber-100 text-amber-800",
  FLAGGED: "bg-orange-100 text-orange-800",
  BASELINE: "bg-blue-100 text-blue-800",
};

export default function StatusBadge({
  status,
  label,
  className = "",
}: StatusBadgeProps) {
  const normalizedStatus = status.toUpperCase();
  const displayLabel =
    label ?? status.toLowerCase().replaceAll("_", " ");

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        statusStyles[normalizedStatus] ?? "bg-slate-100 text-slate-700",
        className,
      ].join(" ")}
    >
      {displayLabel}
    </span>
  );
}
