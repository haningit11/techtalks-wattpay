"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, CircleDollarSign, Layers3, Plus, RefreshCw, X, Zap } from "lucide-react";
import Button from "@/ui/components/actions/Button";
import Input from "@/ui/components/forms/Input";
import { Card, CardContent } from "@/ui/components/containers/Card";
import StatCard from "@/ui/components/containers/StatCard";
import Alert from "@/ui/components/feedback/Alert";
import EmptyState from "@/ui/components/feedback/EmptyState";
import Modal from "@/components/features/tariffs/TariffModal";
import TariffForm from "@/components/features/tariffs/TariffForm";
import TariffTable from "@/components/features/tariffs/TariffTable";
import TariffDetails from "@/components/features/tariffs/TariffDetails";
import { monthLabel, setTariffActive, TariffApiError, tariffRequest, type Tariff } from "@/components/features/tariffs/tariff-client";
import { createSuccessNotificationTimer } from "@/components/features/tariffs/success-notification";

type Result = { key: string; tariffs: Tariff[]; error: string };
type Detail = { id: string; tariff?: Tariff; error?: string };

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function TariffManagementPage() {
  const [month, setMonth] = useState(currentMonth);
  const [status, setStatus] = useState("all");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");
  const [successNotification] = useState(() => createSuccessNotificationTimer(setMessage));
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState<{ tariff?: Tariff } | null>(null);
  const [historicalIds, setHistoricalIds] = useState<Set<string>>(() => new Set());
  const [detail, setDetail] = useState<Detail | null>(null);
  const [statusTariff, setStatusTariff] = useState<Tariff | null>(null);
  const [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const key = `${month}:${revision}`;
  const loading = !result || result.key !== key;
  const data = !loading && result ? result.tariffs : [];
  const visible = data.filter((tariff) => status === "all" || tariff.isActive === (status === "active"));
  const tiers = new Set(data.map((tariff) => tariff.amperage)).size;

  useEffect(() => {
    successNotification.resume();
    return () => successNotification.dispose();
  }, [successNotification]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ billingMonth: `${month}-01` });
    tariffRequest<Tariff[]>(`/api/tariffs?${params}`, { signal: controller.signal })
      .then((tariffs) => setResult({ key, tariffs, error: "" }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ key, tariffs: [], error: error instanceof TariffApiError ? error.message : "Unable to load tariffs. Please try again." });
      });
    return () => controller.abort();
  }, [month, key]);

  async function showDetails(tariff: Tariff) {
    setDetail({ id: tariff.id });
    try {
      const found = await tariffRequest<Tariff>(`/api/tariffs/${encodeURIComponent(tariff.id)}`);
      setDetail((current) => current?.id === tariff.id ? { id: tariff.id, tariff: found } : current);
    } catch (error) {
      setDetail((current) => current?.id === tariff.id ? { id: tariff.id, error: error instanceof TariffApiError ? error.message : "Unable to load tariff details." } : current);
    }
  }

  async function toggleStatus() {
    if (!statusTariff || actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setActionError("");
    try {
      await setTariffActive(statusTariff.id, !statusTariff.isActive);
      successNotification.show(`${statusTariff.name} was ${statusTariff.isActive ? "deactivated" : "activated"}. Its history remains available.`);
      setStatusTariff(null);
      setRevision((value) => value + 1);
    } catch (error) {
      setActionError(error instanceof TariffApiError ? error.message : "Unable to change the tariff status. Please try again.");
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }

  return <main className="wp-container py-8 sm:py-10">
    <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-blue)]"><ArrowLeft size={16} /> Admin dashboard</Link>
    <div className="wp-page-header gap-5">
      <div><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-teal)]"><Zap size={16} /> BILLING SETTINGS</div><h1 className="wp-page-title">Tariff Management</h1><p className="wp-page-description max-w-2xl">Manage monthly electricity pricing for each amperage tier.</p></div>
      <Button leftIcon={<Plus size={18} />} onClick={() => { successNotification.dismiss(); setForm({}); }}>Create tariff</Button>
    </div>

    <section aria-label="Monthly tariff overview" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard title="Total tariffs" value={loading || result?.error ? "—" : data.length} description={`Configured for ${monthLabel(month)}`} icon={<CircleDollarSign size={20} />} />
      <StatCard title="Amperage tiers" value={loading || result?.error ? "—" : tiers} description="Distinct tiers this month" icon={<Layers3 size={20} />} />
      <StatCard title="Active tariffs" value={loading || result?.error ? "—" : data.filter((tariff) => tariff.isActive).length} description="Available pricing plans" icon={<CheckCircle2 size={20} />} />
    </section>

    {message && <div className="relative mb-5"><Alert className="pr-12" variant="success" message={message} /><button type="button" onClick={successNotification.dismiss} aria-label="Dismiss success notification" className="absolute right-3 top-3 rounded-md p-1 text-green-800 hover:bg-green-100"><X size={18} aria-hidden="true" /></button></div>}
    <Card><CardContent>
      <div className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div><h2 className="text-xl">Monthly tariffs</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Review and manage your pricing plans.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:w-auto">
          <Input id="filter-month" type="month" label="Billing month" value={month} onChange={(event) => { if (event.target.value) { setMonth(event.target.value); successNotification.dismiss(); } }} />
          <div className="wp-form-field"><label className="wp-label" htmlFor="filter-status">Status</label><select id="filter-status" className="wp-select min-w-40" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        </div>
      </div>
      <div className="pt-5" aria-live="polite">
        {loading ? <div className="flex items-center justify-center gap-3 py-16 text-sm text-[var(--color-text-secondary)]"><RefreshCw className="animate-spin motion-reduce:animate-none" size={18} /> Loading tariffs...</div> : result?.error ? <div className="space-y-4"><Alert variant="danger" title="Unable to load tariffs" message={result.error} /><Button variant="secondary" leftIcon={<RefreshCw size={16} />} onClick={() => setRevision((value) => value + 1)}>Try again</Button></div> : visible.length === 0 ? <EmptyState icon={<CalendarDays size={22} />} title="No tariffs found" description={data.length ? "No tariffs match the selected status. Try another filter." : `There are no tariffs configured for ${monthLabel(month)} yet.`} action={!data.length ? <Button variant="secondary" leftIcon={<Plus size={16} />} onClick={() => setForm({})}>Create tariff</Button> : undefined} /> : <><div className="mb-3 flex items-center justify-between text-sm text-[var(--color-text-secondary)]"><span>{visible.length} {visible.length === 1 ? "tariff" : "tariffs"} shown</span><span className="hidden sm:inline">Scroll horizontally to see all columns</span></div><TariffTable tariffs={visible} onView={showDetails} onEdit={(tariff) => { successNotification.dismiss(); setForm({ tariff }); }} onToggleStatus={(tariff) => { setActionError(""); setStatusTariff(tariff); }} /></>}
      </div>
    </CardContent></Card>
    <p className="mt-5 text-sm text-[var(--color-text-secondary)]">Tariffs used on bills retain their historical pricing. Deactivation keeps the record available for reference.</p>

    {form && <TariffForm key={form.tariff?.id ?? "new"} tariff={form.tariff} month={month} historical={!!form.tariff && historicalIds.has(form.tariff.id)} onHistorical={(id) => setHistoricalIds((previous) => new Set(previous).add(id))} onClose={() => setForm(null)} onSaved={(notice, savedMonth) => { setForm(null); setMonth(savedMonth); successNotification.show(`${notice} The list shows the saved month and selected status.`); setRevision((value) => value + 1); }} />}
    {detail && (detail.tariff ? <TariffDetails tariff={detail.tariff} onClose={() => setDetail(null)} /> : <Modal onClose={() => setDetail(null)} title="Tariff details">{detail.error ? <Alert variant="danger" message={detail.error} /> : <p role="status" className="text-sm text-[var(--color-text-secondary)]">Loading tariff details...</p>}</Modal>)}
    {statusTariff && <Modal onClose={() => { if (!actionPending.current) setStatusTariff(null); }} title={statusTariff.isActive ? "Deactivate tariff" : "Activate tariff"} footer={<><Button variant="secondary" disabled={busy} onClick={() => setStatusTariff(null)}>Cancel</Button><Button variant={statusTariff.isActive ? "danger" : "primary"} loading={busy} onClick={toggleStatus}>{statusTariff.isActive ? "Deactivate" : "Activate"} tariff</Button></>}><p className="text-sm text-[var(--color-text-body)]">{statusTariff.isActive ? "Deactivate" : "Activate"} <strong>{statusTariff.name}</strong>? Its pricing and history will be preserved.</p>{actionError && <Alert className="mt-4" variant="danger" message={actionError} />}</Modal>}
  </main>;
}
