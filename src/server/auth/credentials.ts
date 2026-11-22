import bcrypt from "bcryptjs";
import { z } from "zod";
import type { UserRole } from "@/generated/prisma/enums";

/** 8-hour session lifetime specified in TDD Section 6.3. */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/**
 * Valid bcrypt cost-12 hash used when an email is unknown so password comparison
 * time stays consistent with existing accounts (TDD Section 5.2, API-01).
 */
const DUMMY_PASSWORD_HASH =
  "$2b$12$s1.vuSLsf.ExOoSWCSS2j.Ac4XLBO4dLV7MJMZlDTB7Q8fISm5rkO";

export const loginSchema = z.object({
  email: z
    .string({ error: "Email is required." })
    .trim()
    .min(1, "Email is required.")
    .max(254, "Enter a valid email address.")
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  password: z
    .string({ error: "Password is required." })
    .min(1, "Password is required.")
    .max(128, "Password must be 128 characters or fewer."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export interface StoredAuthUser {
  id: string;
  fullName: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  fullName: string;
}

export interface CredentialAuthDependencies {
  findUserByEmail?: (email: string) => Promise<StoredAuthUser | null>;
  comparePassword?: (plain: string, hash: string) => Promise<boolean>;
  logFailure?: (event: { timestamp: string; email: string; reason: string }) => void;
}

async function defaultFindUserByEmail(email: string): Promise<StoredAuthUser | null> {
  const { prisma } = await import("@/lib/prisma");
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      fullName: true,
      passwordHash: true,
      role: true,
      isActive: true,
    },
  });
}

function defaultLogFailure(event: {
  timestamp: string;
  email: string;
  reason: string;
}): void {
  // Never log passwords or secrets (TDD Section 5.2, API-01).
  console.warn("[auth] failed sign-in attempt", event);
}

/**
 * Validates credentials against Zod rules and verifies user status + bcrypt hash.
 * Returns minimal session user `{ id, role, fullName }` or `null` for invalid/inactive credentials.
 * Database errors intentionally propagate so callers can distinguish outages from bad credentials.
 */
export async function authorizeCredentials(
  rawCredentials: unknown,
  deps: CredentialAuthDependencies = {},
): Promise<AuthenticatedUser | null> {
  const parsed = loginSchema.safeParse(rawCredentials);
  if (!parsed.success) {
    return null;
  }

  const { email, password } = parsed.data;
  const findUserByEmail = deps.findUserByEmail ?? defaultFindUserByEmail;
  const comparePassword = deps.comparePassword ?? bcrypt.compare;
  const logFailure = deps.logFailure ?? defaultLogFailure;

  const user = await findUserByEmail(email);

  if (!user) {
    await comparePassword(password, DUMMY_PASSWORD_HASH);
    logFailure({
      timestamp: new Date().toISOString(),
      email,
      reason: "invalid_credentials",
    });
    return null;
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);

  if (!passwordMatches || !user.isActive) {
    logFailure({
      timestamp: new Date().toISOString(),
      email,
      reason: user.isActive ? "invalid_credentials" : "inactive_account",
    });
    return null;
  }

  return {
    id: user.id,
    role: user.role,
    fullName: user.fullName,
  };
}

