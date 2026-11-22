"use client";

import { useFormStatus } from "react-dom";
import { logoutAction } from "@/src/server/auth/actions";

interface LogoutButtonProps {
  className?: string;
}

function SubmitLogoutButton({ className }: LogoutButtonProps) {
  const { pending } = useFormStatus();
  const buttonClassName = className
    ? `wp-button wp-button-secondary ${className}`
    : "wp-button wp-button-secondary";

  return (
    <button type="submit" disabled={pending} className={buttonClassName}>
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
