
import type { ReactNode } from "react";

export interface TableColumn<T> {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: keyof T;
  emptyMessage?: string;
}

export default function Table<T extends object>({
  columns,
  data,
  rowKey,
  emptyMessage = "No records found.",
}: TableProps<T>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-[var(--color-surface-secondary)]">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className={`whitespace-nowrap px-4 py-3 font-semibold text-[var(--color-text-secondary)] ${column.className ?? ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-[var(--color-border)] bg-white">
          {data.length > 0 ? (
            data.map((row) => (
              <tr
                key={String(row[rowKey])}
                className="transition-colors hover:bg-[var(--color-surface-secondary)]"
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={`whitespace-nowrap px-4 py-3 text-[var(--color-text)] ${column.className ?? ""}`}
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : String(row[column.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-[var(--color-text-secondary)]"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
