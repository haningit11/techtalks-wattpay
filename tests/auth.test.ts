import bcrypt from "bcryptjs";
import { decode, encode, getToken } from "next-auth/jwt";
import { describe, expect, it, vi } from "vitest";
import type { UserRole } from "@/src/generated/prisma/enums";
import {
  authorizeCredentials,
  loginSchema,
  SESSION_MAX_AGE_SECONDS,
  type StoredAuthUser,
} from "@/src/server/auth/credentials";
import { getRoleHomePage } from "@/src/server/auth/routes";

const TEST_PASSWORD = "WattPayTestPassword!2026";
const TEST_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

function makeSeedUser(role: UserRole, overrides: Partial<StoredAuthUser> = {}): StoredAuthUser {
  return {
    id: `user-${role.toLowerCase()}`,
    fullName: `Test ${role}`,
    passwordHash: TEST_HASH,
    role,
    isActive: true,
    ...overrides,
  };
}

describe("Authentication logic (TDD T-07 to T-10, T-16, T-17)", () => {
  it("T-07: authenticates all four roles and resolves their home routes", async () => {
    const cases: Array<[UserRole, string]> = [
      ["OPERATOR", "/admin"],
      ["METER_READER", "/reader"],
      ["PAYMENT_COLLECTOR", "/collector"],
      ["SUBSCRIBER", "/portal"],
    ];

    for (const [role, expectedPath] of cases) {
      const storedUser = makeSeedUser(role);
      const findUserByEmail = vi.fn(async () => storedUser);

      const authenticated = await authorizeCredentials(
        { email: `  ${role}@WattPay.Test  `, password: TEST_PASSWORD },
        { findUserByEmail },
      );

      expect(findUserByEmail).toHaveBeenCalledWith(`${role.toLowerCase()}@wattpay.test`);
      expect(authenticated).toEqual({
        id: storedUser.id,
        role,
        fullName: storedUser.fullName,
      });
      expect(authenticated).not.toHaveProperty("passwordHash");
      expect(getRoleHomePage(role)).toBe(expectedPath);
    }
  });

  it("T-08: rejects wrong password and unknown email without leaking secrets", async () => {
    const knownUser = makeSeedUser("OPERATOR");
    const logFailure = vi.fn();
    const compareSpy = vi.fn((plain: string, hash: string) => bcrypt.compare(plain, hash));

    const wrongPasswordResult = await authorizeCredentials(
      { email: "operator@wattpay.test", password: "wrong-password" },
      {
        findUserByEmail: async () => knownUser,
        comparePassword: compareSpy,
        logFailure,
      },
    );

    const unknownUserResult = await authorizeCredentials(
      { email: "nobody@wattpay.test", password: TEST_PASSWORD },
      {
        findUserByEmail: async () => null,
        comparePassword: compareSpy,
        logFailure,
      },
    );

    expect(wrongPasswordResult).toBeNull();
    expect(unknownUserResult).toBeNull();
    // Dummy hash comparison runs even when user does not exist.
    expect(compareSpy).toHaveBeenCalledTimes(2);
    expect(logFailure).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(logFailure.mock.calls)).not.toContain(TEST_PASSWORD);
    expect(JSON.stringify(logFailure.mock.calls)).not.toContain("wrong-password");
  });

  it("T-09: validates malformed inputs via Zod without querying the database", async () => {
    const invalidInputs = [
      { email: "", password: TEST_PASSWORD, expectedField: "email" as const },
      { email: "aya@", password: TEST_PASSWORD, expectedField: "email" as const },
      { email: "operator@wattpay.test", password: "", expectedField: "password" as const },
      {
        email: `${"a".repeat(245)}@wattpay.test`,
        password: TEST_PASSWORD,
        expectedField: "email" as const,
      },
    ];

    const findUserByEmail = vi.fn();

    for (const input of invalidInputs) {
      const parsed = loginSchema.safeParse({ email: input.email, password: input.password });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.flatten().fieldErrors[input.expectedField]?.length).toBeGreaterThan(0);
      }

      const result = await authorizeCredentials(
        { email: input.email, password: input.password },
        { findUserByEmail },
      );
      expect(result).toBeNull();
    }

    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it("T-10: rejects deactivated users even when password matches", async () => {
    const inactiveUser = makeSeedUser("METER_READER", { isActive: false });
    const logFailure = vi.fn();

    const result = await authorizeCredentials(
      { email: "reader@wattpay.test", password: TEST_PASSWORD },
      {
        findUserByEmail: async () => inactiveUser,
        logFailure,
      },
    );

    expect(result).toBeNull();
    expect(logFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "reader@wattpay.test",
        reason: "inactive_account",
      }),
    );
  });

  it("T-16: bcrypt hashes start with $2 and do not match plaintext", async () => {
    const hash = await bcrypt.hash(TEST_PASSWORD, 12);
    expect(hash.startsWith("$2")).toBe(true);
    expect(hash).not.toContain(TEST_PASSWORD);
    await expect(bcrypt.compare(TEST_PASSWORD, hash)).resolves.toBe(true);
  });

  it("T-17: enforces an 8-hour session lifetime and rejects expired JWT tokens", async () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(8 * 60 * 60);

    const secret = "test-secret-for-unit-verification-only";
    const salt = "authjs.session-token";
    // Expire well past Auth.js's 15-second clockTolerance window.
    const expiredToken = await encode({
      secret,
      salt,
      maxAge: -60,
      token: {
        sub: "user-operator",
        id: "user-operator",
        role: "OPERATOR",
        fullName: "Test Operator",
      },
    });

    await expect(
      decode({
        secret,
        salt,
        token: expiredToken,
      }),
    ).rejects.toThrow();

    const tokenFromExpiredCookie = await getToken({
      secret,
      cookieName: salt,
      req: {
        headers: {
          cookie: `${salt}=${expiredToken}`,
        },
      },
    });

    expect(tokenFromExpiredCookie).toBeNull();
  });
});
