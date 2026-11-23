import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRoleHomePage } from "@/server/auth/routes";
import type { Role } from "@/server/auth/permissions";
import { LogoutButton } from "./LogoutButton";

async function AuthorizedArea({ children, role }: { children: ReactNode; role: Role }) {
  await connection();
  const user = (await auth())?.user;
  if (!user?.role) redirect("/login");
  if (user.role !== role) redirect(getRoleHomePage(user.role));

  return (
    <>
      <header className="wp-container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1rem" }}>
        <span className="wp-text-secondary wp-text-small">Signed in as {user.fullName}</span>
        <LogoutButton />
      </header>
      {children}
    </>
  );
}

export function RoleLayout({ children, role }: { children: ReactNode; role: Role }) {
  return <Suspense fallback={null}><AuthorizedArea role={role}>{children}</AuthorizedArea></Suspense>;
}
