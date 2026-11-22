
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  title,
  description,
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      ].join(" ")}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
          {icon}
        </div>
      )}

      <h3 className="text-base font-semibold text-[var(--color-text)]">
        {title}
      </h3>

      {description && (
        <p className="mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
          {description}
        </p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
