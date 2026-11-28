"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { sendJson } from "./api";

export function RouteForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const message = await sendJson("/api/routes", "POST", {
      name,
      description: description || undefined,
    });
    setSaving(false);
    if (message) return setError(message);
    setName("");
    setDescription("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="wp-card">
      <div className="wp-card-body" style={{ display: "grid", gap: "0.75rem" }}>
        <h3>Add a collection route</h3>
        <label>
          Name
          <input className="wp-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} />
        </label>
        <label>
          Description (optional)
          <input className="wp-input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
        <button type="submit" className="wp-button wp-button-primary" disabled={saving}>
          {saving ? "Saving…" : "Add route"}
        </button>
      </div>
    </form>
  );
}