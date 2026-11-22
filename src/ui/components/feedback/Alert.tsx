
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";

type AlertVariant = "success" | "warning" | "danger" | "info";

interface AlertProps {
  title?: string;
  message: string;
  variant?: AlertVariant;
  icon?: ReactNode;
  className?: string;
}

const alertStyles: Record<AlertVariant, string> = {
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

const defaultIcons = {
  success: <CheckCircle2 size={20} />,
  warning: <AlertTriangle size={20} />,
  danger: <AlertCircle size={20} />,
  info: <Info size={20} />,
};

export default function Alert({
  title,
  message,
  variant = "info",
  icon,
  className = "",
}: AlertProps) {
  return (
    <div
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      className={[
        "flex items-start gap-3 rounded-lg border p-4",
        alertStyles[variant],
        className,
      ].join(" ")}
    >
      <span className="mt-0.5 shrink-0">
        {icon ?? defaultIcons[variant]}
      </span>

      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <p className={title ? "mt-1 text-sm" : "text-sm"}>{message}</p>
      </div>
    </div>
  );
}
