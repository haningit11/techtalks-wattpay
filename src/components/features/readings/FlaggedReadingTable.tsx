"use client";

import { Info } from "lucide-react";
import type { KeyboardEvent } from "react";
import Button from "@/ui/components/actions/Button";
import StatusBadge from "@/ui/components/feedback/StatusBadge";
import { monthLabel, type ReviewReading } from "./review-client";

function reasonLabel(reason: string | null): string {
  if (!reason) return "Reason unavailable";
  const text = reason.toLowerCase();
  if (text.includes("lower than") || text.includes("below previous")) return "Lower than previous";
  if (text.includes("zero consumption") || text.includes("equals the previous")) return "Zero consumption";
  if (text.includes("high-consumption") || text.includes("high consumption")) return "High consumption";
  return "Flagged reading";
}

// Native details/summary supports mouse, touch, Enter and Space without custom click handling.
export function FlagReason({ reason, subscriber }: { reason: string | null; subscriber: string }) {
  function onKeyDown(event: KeyboardEvent<HTMLDetailsElement>) {
    if (event.key === "Escape" && event.currentTarget.open) {
      event.preventDefault();
      event.currentTarget.open = false;
      event.currentTarget.querySelector("summary")?.focus();
    }
  }
  return <details className="group relative min-w-0" onKeyDown={onKeyDown}>
    <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded text-left text-sm text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-blue)] [&::-webkit-details-marker]:hidden" aria-label={`Show flag reason for ${subscriber}`}>
      <span className="min-w-0 break-words">{reasonLabel(reason)}</span><Info aria-hidden="true" size={16} className="shrink-0 text-[var(--color-blue)]" />
    </summary>
    <div className="relative z-20 mt-2 rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm leading-relaxed text-[var(--color-text)] shadow-lg md:absolute md:right-0 md:w-72 md:max-w-[calc(100vw-3rem)]">
      <span className="block text-xs font-semibold text-[var(--color-text-secondary)]">Flag reason</span>
      <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{reason ?? "No flag reason was provided."}</p>
    </div>
  </details>;
}

function ReviewButton({ reading, onReview }: { reading: ReviewReading; onReview: (reading: ReviewReading) => void }) {
  return <Button variant="primary" size="sm" aria-label={`Review reading for ${reading.subscription.subscriber.fullName}, ${monthLabel(reading.billingMonth)}`} onClick={() => onReview(reading)}>Review</Button>;
}

export default function FlaggedReadingTable({ readings, onReview }: { readings: ReviewReading[]; onReview: (reading: ReviewReading) => void }) {
  const head = "px-2 py-3 text-left align-top text-xs font-semibold text-[var(--color-text-secondary)] lg:px-3";
  const cell = "px-2 py-3 align-top text-sm break-words [overflow-wrap:anywhere] lg:px-3";
  return <>
    <div className="hidden rounded-lg border border-[var(--color-border)] md:block">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <colgroup><col className="w-[16%]" /><col className="w-[12%]" /><col className="w-[13%]" /><col className="w-[13%]" /><col className="w-[13%]" /><col className="w-[20%]" /><col className="w-[13%]" /></colgroup>
        <thead className="bg-[var(--color-surface-secondary)]"><tr>
          <th scope="col" className={head}>Subscriber</th><th scope="col" className={head}>Building</th><th scope="col" className={head}>Billing month</th><th scope="col" className={head}>Previous reading</th><th scope="col" className={head}>Submitted reading</th><th scope="col" className={head}>Flag reason</th><th scope="col" className={head}>Action</th>
        </tr></thead>
        <tbody className="divide-y divide-[var(--color-border)]">{readings.map((reading) => <tr key={reading.id} className="hover:bg-[var(--color-surface-secondary)]">
          <td className={cell}><span className="font-semibold">{reading.subscription.subscriber.fullName}</span><div className="mt-1"><StatusBadge status={reading.status} /></div></td>
          <td className={cell}>{reading.subscription.subscriber.building.name}</td>
          <td className={cell}>{monthLabel(reading.billingMonth)}</td>
          <td className={`${cell} tabular-nums`}>{reading.previousReadingValue === null ? "—" : `${reading.previousReadingValue} kWh`}</td>
          <td className={`${cell} font-medium tabular-nums`}>{reading.submittedValue} kWh</td>
          <td className={cell}><FlagReason reason={reading.flagReason} subscriber={reading.subscription.subscriber.fullName} /></td>
          <td className={cell}><ReviewButton reading={reading} onReview={onReview} /></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="space-y-3 md:hidden">{readings.map((reading) => <article key={reading.id} className="min-w-0 rounded-xl border border-[var(--color-border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold [overflow-wrap:anywhere]">{reading.subscription.subscriber.fullName}</h3><p className="mt-1 break-words text-sm text-[var(--color-text-secondary)] [overflow-wrap:anywhere]">{reading.subscription.subscriber.building.name}</p></div><StatusBadge status={reading.status} /></div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-[var(--color-text-secondary)]">Billing month</dt><dd className="mt-1 break-words">{monthLabel(reading.billingMonth)}</dd></div><div><dt className="text-xs text-[var(--color-text-secondary)]">Previous reading</dt><dd className="mt-1 break-words tabular-nums [overflow-wrap:anywhere]">{reading.previousReadingValue === null ? "—" : `${reading.previousReadingValue} kWh`}</dd></div><div><dt className="text-xs text-[var(--color-text-secondary)]">Submitted reading</dt><dd className="mt-1 break-words font-medium tabular-nums [overflow-wrap:anywhere]">{reading.submittedValue} kWh</dd></div></dl>
      <div className="mt-4 border-t border-[var(--color-border)] pt-3"><p className="mb-1 text-xs text-[var(--color-text-secondary)]">Flag reason</p><FlagReason reason={reading.flagReason} subscriber={reading.subscription.subscriber.fullName} /></div>
      <div className="mt-4"><ReviewButton reading={reading} onReview={onReview} /></div>
    </article>)}</div>
  </>;
}
