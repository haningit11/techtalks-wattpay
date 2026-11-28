"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck, RefreshCw, X } from "lucide-react";
import Button from "@/ui/components/actions/Button";
import { Card, CardContent } from "@/ui/components/containers/Card";
import Alert from "@/ui/components/feedback/Alert";
import EmptyState from "@/ui/components/feedback/EmptyState";
import FlaggedReadingTable from "@/components/features/readings/FlaggedReadingTable";
import ReadingDetails from "@/components/features/readings/ReadingDetails";
import { listFlaggedReadings, ReviewApiError, type ResolvedReading, type ReviewReading } from "@/components/features/readings/review-client";
import { createSuccessNotificationTimer } from "@/components/features/tariffs/success-notification";

type Result = { revision: number; readings: ReviewReading[]; error: string };
export default function FlaggedReadingsPage() {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<ReviewReading | null>(null);
  const [resolved, setResolved] = useState<ResolvedReading | null>(null);
  const [notice, setNotice] = useState("");
  const [successNotification] = useState(() => createSuccessNotificationTimer(setNotice));
  const close = useCallback(() => { setSelected(null); setResolved(null); }, []);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const loading = !result || result.revision !== revision;

  useEffect(() => {
    successNotification.resume();
    return () => successNotification.dispose();
  }, [successNotification]);

  useEffect(() => {
    const controller = new AbortController();
    listFlaggedReadings(controller.signal).then((readings) => setResult({ revision, readings, error: "" })).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ revision, readings: [], error: error instanceof ReviewApiError ? error.message : "Unable to load readings. Please try again." });
    });
    return () => controller.abort();
  }, [revision]);

  return <main className="wp-container py-8 sm:py-10">
    <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-blue)]"><ArrowLeft size={16} /> Admin dashboard</Link>
    <div className="wp-page-header gap-5"><div><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-teal)]"><ClipboardCheck size={16} /> READING REVIEW</div><h1 className="wp-page-title">Flagged readings</h1><p className="wp-page-description max-w-2xl">Inspect unusual meter readings and record a verified value for each subscriber.</p></div><Button id="refresh-readings" variant="secondary" leftIcon={<RefreshCw size={16} />} onClick={refresh} disabled={loading}>Refresh</Button></div>
    {notice && <div className="relative mb-5"><Alert className="pr-12" variant="success" message={notice} /><button type="button" onClick={successNotification.dismiss} aria-label="Dismiss success notification" className="absolute right-3 top-3 rounded-md p-1 text-green-800 hover:bg-green-100"><X size={18} aria-hidden="true" /></button></div>}
    <Card><CardContent><div className="border-b border-[var(--color-border)] pb-5"><h2 className="text-xl font-semibold">Awaiting review</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Original submissions remain in the reading history.</p></div>
      <div className="pt-5" aria-live="polite">{loading ? <p className="flex items-center justify-center gap-3 py-16 text-sm text-[var(--color-text-secondary)]"><RefreshCw className="animate-spin motion-reduce:animate-none" size={18} /> Loading readings...</p> : result.error ? <div className="space-y-4"><Alert variant="danger" title="Unable to load readings" message={result.error} /><Button variant="secondary" onClick={refresh}>Try again</Button></div> : result.readings.length === 0 ? <EmptyState icon={<ClipboardCheck size={22} />} title="No flagged readings" description="There are no readings awaiting review." /> : <><p className="mb-3 text-sm text-[var(--color-text-secondary)]">{result.readings.length} {result.readings.length === 1 ? "reading" : "readings"} awaiting review</p><FlaggedReadingTable readings={result.readings} onReview={(reading) => { successNotification.dismiss(); setResolved(null); setSelected(reading); }} /></>}</div>
    </CardContent></Card>
    {selected && <ReadingDetails key={selected.id} reading={selected} resolved={resolved} onClose={close} onResolved={(updated) => { setResolved(updated); successNotification.show(`Reading for ${selected.subscription.subscriber.fullName} was resolved.`); refresh(); }} onConflict={(error) => { if (error.reason === "NOT_FLAGGED" || error.reason === "CONCURRENT_RESOLUTION") refresh(); }} />}
  </main>;
}
