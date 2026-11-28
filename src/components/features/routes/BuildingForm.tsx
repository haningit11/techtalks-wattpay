"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { sendJson } from "./api";

export function BuildingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const message = await sendJson("/api/buildings", "POST", {
      name,
      address,
      description: description || undefined,
    });
    setSaving(false);
    if (message) return setError(message);
    setName("");
    setAddress("");
    setDescription("");
    router.refresh(); // reloads the page data so the new building appears
  }

  return (
    <form onSubmit={handleSubmit} className="wp-card">
      <div className="wp-card-body" style={{ display: "grid", gap: "0.75rem" }}>
        <h3>Add a building</h3>
        <label>
          Name
          <input className="wp-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} />
        </label>
        <label>
          Address
          <input className="wp-input" value={address} onChange={(e) => setAddress(e.target.value)} required maxLength={255} />
        </label>
        <label>
          Description (optional)
          <input className="wp-input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
        <button type="submit" className="wp-button wp-button-primary" disabled={saving}>
          {saving ? "Saving…" : "Add building"}
        </button>
      </div>
    </form>
  );
}