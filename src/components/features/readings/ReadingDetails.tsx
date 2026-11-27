"use client";

import { useEffect, useRef } from "react";
import Modal from "@/ui/components/overlays/Modal";
import StatusBadge from "@/ui/components/feedback/StatusBadge";
import Alert from "@/ui/components/feedback/Alert";
import ReviewReadingForm from "./ReviewReadingForm";
import { monthLabel, type ResolvedReading, type ReviewApiError, type ReviewReading } from "./review-client";

type Props = { reading: ReviewReading; resolved: ResolvedReading | null; onClose: () => void; onResolved: (reading: ResolvedReading) => void; onConflict: (error: ReviewApiError) => void };

export default function ReadingDetails({ reading, resolved, onClose, onResolved, onConflict }: Props) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = content.current?.closest<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter((item) => item.getClientRects().length > 0);
    focusable()[0]?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === elements[0] || !dialog?.contains(document.activeElement))) { event.preventDefault(); elements[elements.length - 1].focus(); }
      else if (!event.shiftKey && (document.activeElement === elements[elements.length - 1] || !dialog?.contains(document.activeElement))) { event.preventDefault(); elements[0].focus(); }
    }
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus(); else document.getElementById("refresh-readings")?.focus(); };
  }, []);
  const subscriber = reading.subscription.subscriber;
  const submittedDate = new Date(reading.createdAt);
  const date = Number.isNaN(submittedDate.valueOf()) ? reading.createdAt : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(submittedDate);
  const fields = [
    ["Subscriber", subscriber.fullName], ["Address", subscriber.address], ["Building", subscriber.building.name],
    ["Route", subscriber.route.name], ["Subscription", `${reading.subscription.amperage} A`],
    ["Billing month", monthLabel(reading.billingMonth)], ["Previous reading", reading.previousReadingValue === null ? "Unavailable" : `${reading.previousReadingValue} kWh`],
    ["Submitted on", date],
  ];
  return <Modal isOpen onClose={onClose} title="Reading details" size="lg"><div ref={content} className="space-y-5">
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-[var(--color-text-secondary)]">Review the reading and subscriber details below.</p><StatusBadge status={resolved?.status ?? reading.status} /></div>
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label}><dt className="text-xs text-[var(--color-text-secondary)]">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}</dl>
    <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-medium text-amber-800">Original submitted reading</p><p className="mt-1 text-lg font-semibold tabular-nums">{reading.submittedValue} kWh</p></div><div className="rounded-lg border border-teal-200 bg-teal-50 p-4"><p className="text-xs font-medium text-teal-800">Approved reading</p><p className="mt-1 text-lg font-semibold tabular-nums">{resolved?.approvedValue != null ? `${resolved.approvedValue} kWh` : "Not yet approved"}</p></div></div>
    <div><p className="text-xs text-[var(--color-text-secondary)]">Flag reason</p><p className="mt-1 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{reading.flagReason ?? "Not provided"}</p></div>
    {resolved ? <><Alert variant="success" title="Reading resolved" message={`Calculated consumption: ${resolved.consumptionKwh ?? "—"} kWh`} /><div><p className="text-xs text-[var(--color-text-secondary)]">Review note</p><p className="mt-1 whitespace-pre-wrap text-sm">{resolved.reviewNote}</p></div></> : <ReviewReadingForm id={reading.id} previous={reading.previousReadingValue} onResolved={onResolved} onConflict={onConflict} />}
  </div></Modal>;
}
