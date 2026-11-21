"use client";

import { useFormStatus } from "react-dom";
import { logoutAction } from "@/src/server/auth/actions";

interface LogoutButtonProps {
  className?: string;
}

function SubmitLogoutButton({ className }: LogoutButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {pending ? "Signing out..." : "Log out"}
    </button>
  );
}

/**
 * Reusable sign-out button bound to `logoutAction`. Disables itself while
 * submitting to prevent duplicate sign-out requests.
 */
export function LogoutButton({ className }: LogoutButtonProps) {
  return (
    <form action={logoutAction}>
      <SubmitLogoutButton className={className} />
    </form>
  );
}
