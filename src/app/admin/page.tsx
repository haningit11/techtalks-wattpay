// src/app/admin/page.tsx
// Admin (Operator) landing page. Uses the shared WattPay classes from globals.css.
// Access is protected in src/app/admin/layout.tsx (only OPERATOR), not here.

import Link from "next/link";

const sections = [
  { href: "/admin/subscribers", title: "Subscribers", requirement: "R1", description: "Register subscribers and create their accounts." },
  { href: "/admin/routes", title: "Buildings & routes", requirement: "R1", description: "Organize subscribers and assign staff to routes." },
  { href: "/admin/readings", title: "Flagged readings", requirement: "R2", description: "Review and correct suspicious meter readings." },
  { href: "/admin/tariffs", title: "Tariffs", requirement: "R3", description: "Set the monthly rate per kWh and the fixed fee." },
  { href: "/admin/bills", title: "Bills", requirement: "R3", description: "Generate bills and view itemized bills." },
];

export default function AdminPage() {
  return (
    <main className="wp-container py-8">
      <div className="wp-page-header">
        <div>
          <h1 className="wp-page-title">Admin dashboard</h1>
          <p className="wp-page-description">
            Manage subscribers, readings, tariffs and bills for your generator.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="wp-card wp-card-interactive block">
            <div className="wp-card-body">
              <span className="wp-badge wp-badge-info">{section.requirement}</span>
              <h2 className="mt-3" style={{ fontSize: "var(--text-lg)" }}>
                {section.title}
              </h2>
              <p className="wp-text-secondary wp-text-small mt-1">{section.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}