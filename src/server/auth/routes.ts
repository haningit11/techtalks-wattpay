import type { UserRole } from "@/generated/prisma/enums";

/** Home route assigned to each WattPay role (TDD Section 5.2, API-01). */
export const ROLE_HOME_PAGES: Record<UserRole, string> = {
  OPERATOR: "/admin",
  METER_READER: "/reader",
  PAYMENT_COLLECTOR: "/collector",
  SUBSCRIBER: "/portal",
};

export function getRoleHomePage(role: UserRole): string {
  return ROLE_HOME_PAGES[role] ?? "/login";
}
