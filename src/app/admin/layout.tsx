import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { LogoutButton } from "../../components/auth/LogoutButton";
import { can, HOME_PAGE, type Role } from "../../server/auth/permissions";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // 1. Ask Auth.js who is logged in (this runs on the server)
  const session = await auth();
  const user = session?.user;

  // 2. Nobody logged in → go to the login page
  if (!user) {
    redirect("/login");
  }

  // 3. Logged in but not allowed in admin → go to their own home page
  const role = user.role as Role;
  if (!can(role, "dashboard:view")) {
    redirect(HOME_PAGE[role]);
  }

  // 4. Operator → show a header with the logout button, then the page
  return (
    <>
      <header
        className="wp-container"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1rem" }}
      >
        <span className="wp-text-secondary wp-text-small">Signed in as {user.fullName}</span>
        <LogoutButton />
      </header>
      {children}
    </>
  );
}