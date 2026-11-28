"use client";

import { useRef, useState, type FormEvent } from "react";
import Button from "@/ui/components/actions/Button";
import Input from "@/ui/components/forms/Input";
import Alert from "@/ui/components/feedback/Alert";
import { ReviewApiError, submitReview, validateReview, type ResolvedReading } from "./review-client";

type Props = { id: string; previous: string | null; onResolved: (reading: ResolvedReading) => void; onConflict: (error: ReviewApiError) => void };
export default function ReviewReadingForm({ id, previous, onResolved, onConflict }: Props) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ value?: string; note?: string }>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const next = validateReview(value, note, previous);
    setErrors(next);
    if (next.value || next.note) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try { onResolved(await submitReview(id, value, note)); }
    catch (caught) {
      const message = caught instanceof ReviewApiError ? caught.message : "Unable to review this reading. Please try again.";
      setError(message);
      if (caught instanceof ReviewApiError && caught.status === 409) onConflict(caught);
    } finally { pending.current = false; setBusy(false); }
  }

  return <form onSubmit={submit} noValidate className="space-y-4 border-t border-[var(--color-border)] pt-5">
    <div><h3 className="text-lg font-semibold">Resolve reading</h3><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Enter the verified cumulative meter value. The original submission will be preserved.</p></div>
    <Input id="approved-reading" label="Approved reading (kWh)" type="text" inputMode="decimal" required value={value} onChange={(event) => setValue(event.target.value)} error={errors.value} helperText="Up to 3 decimal places; equal to the previous value is allowed." />
    <div className="wp-form-field"><label htmlFor="review-note" className="wp-label">Review note <span aria-hidden="true" className="wp-input-required">*</span></label><textarea id="review-note" className={`wp-textarea w-full ${errors.note ? "wp-textarea-error" : ""}`} required value={note} onChange={(event) => setNote(event.target.value)} aria-invalid={!!errors.note} aria-describedby={errors.note ? "review-note-error" : undefined} rows={3} />{errors.note && <p id="review-note-error" className="wp-field-error" role="alert">{errors.note}</p>}</div>
    {error && <Alert variant="danger" title="Review could not be completed" message={error} />}
    <Button type="submit" variant="primary" loading={busy} disabled={busy || previous === null}>Resolve reading</Button>
  </form>;
}
