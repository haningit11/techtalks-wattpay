"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendJson } from "./api";

type Route = { id: string; name: string; description: string | null; isActive: boolean };

export function RouteTable({ routes }: { routes: Route[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(route: Route) {
    setBusyId(route.id);
    setError(null);
    const message = await sendJson(`/api/routes/${route.id}`, "PATCH", { isActive: !route.isActive });
    setBusyId(null);
    if (message) return setError(message);
    router.refresh();
  }

  if (routes.length === 0) {
    return <p className="wp-text-secondary">No routes yet. Add the first one above.</p>;
  }
  return (
    <>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Name</th>
            <th align="left">Description</th>
            <th align="left">Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => (
            <tr key={route.id}>
              <td>{route.name}</td>
              <td className="wp-text-secondary">{route.description ?? "—"}</td>
              <td>
                <span className="wp-badge wp-badge-info">{route.isActive ? "Active" : "Inactive"}</span>
              </td>
              <td>
                <button className="wp-button" onClick={() => toggle(route)} disabled={busyId === route.id}>
                  {route.isActive ? "Deactivate" : "Reactivate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}