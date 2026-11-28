import { Suspense } from "react";
import { listBuildings } from "@/server/services/building.service";
import {
  listAssignableStaff,
  listAssignments,
  listRoutes,
} from "@/server/services/route.service";
import { BuildingForm } from "@/components/features/routes/BuildingForm";
import { BuildingTable } from "@/components/features/routes/BuildingTable";
import { RouteForm } from "@/components/features/routes/RouteForm";
import { RouteTable } from "@/components/features/routes/RouteTable";
import { AssignmentForm } from "@/components/features/routes/AssignmentForm";

// Only Operators reach this page: admin/layout.tsx already checks the role.
export default function RoutesAdminPage() {
  return (
    <main className="wp-container">
      <header className="wp-page-header">
        <h1 className="wp-page-title">Buildings & routes</h1>
        <p className="wp-page-description">
          Manage buildings, collection routes and which staff work on each route.
        </p>
      </header>
      <Suspense fallback={<p className="wp-text-secondary">Loading…</p>}>
        <RoutesContent />
      </Suspense>
    </main>
  );
}

async function RoutesContent() {
  // Load everything at the same time, straight from the database (server side)
  const [buildings, routes, assignments, staff] = await Promise.all([
    listBuildings(),
    listRoutes(),
    listAssignments(),
    listAssignableStaff(),
  ]);

  return (
    <div style={{ display: "grid", gap: "2rem" }}>
      <section style={{ display: "grid", gap: "1rem" }}>
        <h2>Buildings</h2>
        <BuildingForm />
        <BuildingTable buildings={buildings} />
      </section>

      <section style={{ display: "grid", gap: "1rem" }}>
        <h2>Collection routes</h2>
        <RouteForm />
        <RouteTable routes={routes} />
      </section>

      <section style={{ display: "grid", gap: "1rem" }}>
        <h2>Staff assignments</h2>
        <AssignmentForm
          staff={staff}
          routes={routes.filter((route) => route.isActive)}
          assignments={assignments}
        />
      </section>
    </div>
  );
}