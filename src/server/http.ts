import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, type Action, type Role } from "@/server/auth/permissions";
import { ServiceError } from "@/server/services/service-error";

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// Checks login + permission on the SERVER, and returns the current user.
export async function requirePermission(action: Action) {
  const session = await auth();
  const sessionUser = session?.user;
  if (!sessionUser?.id) {
    throw new HttpError(401, "UNAUTHENTICATED", "Please sign in.");
  }

  // Fresh account check (TDD 6.2 #5): a deactivated user loses access immediately
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) {
    throw new HttpError(401, "UNAUTHENTICATED", "Please sign in.");
  }

  if (!can(user.role as Role, action)) {
    throw new HttpError(403, "FORBIDDEN", "You do not have permission to perform this action.");
  }
  return user;
}

// Reads the request body; broken JSON becomes a clean 400 instead of a crash
export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

// Turns any error into the TDD error format: { success: false, error: { code, message } }
export function handleApiError(error: unknown) {
  if (isUniqueConstraintError(error)) {
    return fail(409, "CONFLICT", "This record already exists.");
  }
  if (error instanceof HttpError) return fail(error.status, error.code, error.message);
  if (error instanceof ZodError) {
    return fail(400, "VALIDATION_ERROR", error.issues[0]?.message ?? "Invalid input.");
  }
  if (error instanceof ServiceError) {
    const status = { NOT_FOUND: 404, CONFLICT: 409, INVALID: 400 }[error.code];
    return fail(status, error.code, error.message);
  }
  console.error("[api] unexpected error", error); // details stay on the server
  return fail(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}

// Prisma error P2002 = the database's unique rule rejected a duplicate.
// Happens when two identical requests arrive at the same moment.
function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}