"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn, signOut } from "@/auth";
import { loginSchema } from "@/server/auth/credentials";

export interface LoginActionState {
  error?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
  };
  email?: string;
}

/**
 * Server Action that validates login form inputs with Zod, delegates verification
 * to Auth.js Credentials sign-in, and returns safe user-facing messages on failure.
 */
export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const rawEmail = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";
  const rawPassword =
    typeof formData.get("password") === "string" ? String(formData.get("password")) : "";

  const parsed = loginSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      email: rawEmail,
      fieldErrors: {
        email: flattened.email?.[0],
        password: flattened.password?.[0],
      },
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return {
        email: rawEmail,
        error: "Invalid email or password. If your account is inactive, contact your administrator.",
      };
    }

    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return {
          email: rawEmail,
          error: "Invalid email or password. If your account is inactive, contact your administrator.",
        };
      }

      console.error("[auth] sign-in service failure", {
        type: error.type,
        timestamp: new Date().toISOString(),
      });
      return {
        email: rawEmail,
        error: "Sign-in is temporarily unavailable. Please try again.",
      };
    }

    // Re-throw Next.js internal redirect signal when signIn succeeds.
    throw error;
  }
}

/**
 * Server Action that signs out the current user via Auth.js, clears the session
 * cookie, and redirects to `/login` (safe even when no session exists — TDD API-02).
 */
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
