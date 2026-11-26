"use client";

import { useRef, useState, type FormEvent } from "react";
import Button from "@/ui/components/actions/Button";
import Input from "@/ui/components/forms/Input";
import Alert from "@/ui/components/feedback/Alert";
import Modal from "./TariffModal";
import { TariffApiError, tariffChanges, tariffRequest, type Tariff, type TariffValues } from "./tariff-client";

type Props = { tariff?: Tariff; month: string; onClose: () => void; onSaved: (message: string, billingMonth: string) => void; historical?: boolean; onHistorical: (id: string) => void };
type FormValues = Omit<TariffValues, "billingMonth"> & { billingMonth: string };
type FieldErrors = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim()) errors.name = "Enter a tariff name.";
  else if (values.name.trim().length > 150) errors.name = "Use 150 characters or fewer.";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(values.billingMonth)) errors.billingMonth = "Choose a billing month.";
  const fields = [
    ["amperage", /^\d{1,4}(?:\.\d{1,2})?$/, "Use a positive number with up to 2 decimal places."],
    ["ratePerKwh", /^\d{1,8}(?:\.\d{1,4})?$/, "Use a nonnegative number with up to 4 decimal places."],
    ["fixedFee", /^\d{1,10}(?:\.\d{1,2})?$/, "Use a nonnegative number with up to 2 decimal places."],
  ] as const;
  for (const [key, pattern, message] of fields) {
    if (!pattern.test(values[key]) || (key === "amperage" && !/[1-9]/.test(values[key]))) errors[key] = message;
  }
  if (values.currency !== "USD") errors.currency = "Only USD is supported.";
  return errors;
}

export default function TariffForm({ tariff, month, onClose, onSaved, historical = false, onHistorical }: Props) {
  const original: FormValues = tariff ? { name: tariff.name, billingMonth: tariff.billingMonth.slice(0, 7), amperage: tariff.amperage, ratePerKwh: tariff.ratePerKwh, fixedFee: tariff.fixedFee, currency: tariff.currency } : { name: "", billingMonth: month, amperage: "", ratePerKwh: "", fixedFee: "", currency: "USD" };
  const [values, setValues] = useState(original);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState(historical ? "This tariff has been used in a bill. Its month, tier and pricing are locked to protect billing history." : "");
  const [locked, setLocked] = useState(historical);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const set = (key: keyof FormValues, value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };
  const close = () => { if (!submitting.current) onClose(); };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const fieldErrors = validate(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    const body = tariff ? tariffChanges(values, original, locked) : { ...values, name: values.name.trim(), billingMonth: `${values.billingMonth}-01` };
    if (tariff && Object.keys(body).length === 0) {
      setMessage("There are no changes to save.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setMessage("");
    try {
      const saved = await tariffRequest<Tariff>(tariff ? `/api/tariffs/${encodeURIComponent(tariff.id)}` : "/api/tariffs", { method: tariff ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      onSaved(tariff ? "Tariff updated successfully." : "Tariff created successfully.", saved.billingMonth.slice(0, 7));
    } catch (error) {
      if (error instanceof TariffApiError && error.historical && tariff) {
        setLocked(true);
        onHistorical(tariff.id);
        setValues((previous) => ({ ...original, name: previous.name }));
      }
      setMessage(error instanceof TariffApiError ? error.message : "Unable to save the tariff. Please try again.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return <Modal onClose={close} title={tariff ? "Edit tariff" : "Create tariff"} size="lg">
    <p className="mb-5 text-sm text-[var(--color-text-secondary)]">Set a monthly price for one amperage tier. All amounts are in USD. Tariffs used by bills retain their historical pricing.</p>
    <form onSubmit={submit} noValidate className="space-y-5">
      {message && <Alert variant={locked ? "warning" : "danger"} message={message} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="tariff-name" label="Tariff name" required value={values.name} onChange={(e) => set("name", e.target.value)} error={errors.name} placeholder="e.g. Residential 5A" maxLength={150} disabled={saving} />
        <Input id="tariff-month" type="month" label="Billing month" required value={values.billingMonth} onChange={(e) => set("billingMonth", e.target.value)} error={errors.billingMonth} disabled={locked || saving} />
        <Input id="tariff-amperage" label="Amperage (A)" required inputMode="decimal" value={values.amperage} onChange={(e) => set("amperage", e.target.value)} error={errors.amperage} placeholder="e.g. 5" disabled={locked || saving} />
        <Input id="tariff-currency" label="Currency" value="USD" disabled />
        <Input id="tariff-rate" label="Rate per kWh (USD)" required inputMode="decimal" value={values.ratePerKwh} onChange={(e) => set("ratePerKwh", e.target.value)} error={errors.ratePerKwh} helperText="Up to 4 decimal places" placeholder="e.g. 0.4500" disabled={locked || saving} />
        <Input id="tariff-fee" label="Fixed monthly fee (USD)" required inputMode="decimal" value={values.fixedFee} onChange={(e) => set("fixedFee", e.target.value)} error={errors.fixedFee} helperText="Up to 2 decimal places" placeholder="e.g. 10.00" disabled={locked || saving} />
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--color-border)] pt-5"><Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button><Button type="submit" loading={saving}>{tariff ? "Save changes" : "Create tariff"}</Button></div>
    </form>
  </Modal>;
}
