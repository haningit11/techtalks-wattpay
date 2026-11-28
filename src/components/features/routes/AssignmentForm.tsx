"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { sendJson } from "./api";

type Staff = { id: string; fullName: string; role: string };
type RouteOption = { id: string; name: string };
type Assignment = {
  id: string;
  isActive: boolean;
  user: { fullName: string; role: string };
  route: { name: string };
};

const ROLE_LABEL: Record<string, string> = {
  METER_READER: "Meter Reader",
  PAYMENT_COLLECTOR: "Payment Collector",
};

export function AssignmentForm({
  staff,
  routes,
  assignments,
}: {
  staff: Staff[];
  routes: RouteOption[];
  assignments: Assignment[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const message = await sendJson("/api/route-assignments", "POST", { userId, routeId });
    setSaving(false);
    if (message) return setError(message);
    setUserId("");
    setRouteId("");
    router.refresh();
  }

  async function toggle(assignment: Assignment) {
    setError(null);
    const message = await sendJson(`/api/route-assignments/${assignment.id}`, "PATCH", {
      isActive: !assignment.isActive,
    });
    if (message) return setError(message);
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <form onSubmit={handleSubmit} className="wp-card">
        <div className="wp-card-body" style={{ display: "grid", gap: "0.75rem" }}>
          <h3>Assign staff to a route</h3>
          <label>
            Staff member
            <select className="wp-input" value={userId} onChange={(e) => setUserId(e.target.value)} required>
              <option value="">Choose…</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName} ({ROLE_LABEL[person.role] ?? person.role})
                </option>
              ))}
            </select>
          </label>
          <label>
            Route (active routes only)
            <select className="wp-input" value={routeId} onChange={(e) => setRouteId(e.target.value)} required>
              <option value="">Choose…</option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>{route.name}</option>
              ))}
            </select>
          </label>
          {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
          <button type="submit" className="wp-button wp-button-primary" disabled={saving}>
            {saving ? "Saving…" : "Assign"}
          </button>
        </div>
      </form>

      {assignments.length === 0 ? (
        <p className="wp-text-secondary">No staff assigned yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Staff</th>
              <th align="left">Role</th>
              <th align="left">Route</th>
              <th align="left">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id}>
                <td>{assignment.user.fullName}</td>
                <td>{ROLE_LABEL[assignment.user.role] ?? assignment.user.role}</td>
                <td>{assignment.route.name}</td>
                <td>
                  <span className="wp-badge wp-badge-info">{assignment.isActive ? "Active" : "Inactive"}</span>
                </td>
                <td>
                  <button className="wp-button" onClick={() => toggle(assignment)}>
                    {assignment.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}