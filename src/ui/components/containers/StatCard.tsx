
import type { ReactNode } from "react";
import { Card, CardContent } from "./Card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  className?: string;
}

export default function StatCard({
  title,
  value,
  icon,
  description,
  className = "",
}: StatCardProps) {
  return (
    <Card className={className}>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              {title}
            </p>

            <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
              {value}
            </p>

            {description && (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {description}
              </p>
            )}
          </div>

          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-secondary)] text-[var(--color-primary)]">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
