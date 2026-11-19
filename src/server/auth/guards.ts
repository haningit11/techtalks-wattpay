// src/server/auth/guards.ts
// WattPay authorization guards — the code version of TDD Sections 5.3 and 6.2.

import { getScope, type Action, type Role, type Scope } from "./permissions";

// 1. The signed-in user, as stored in the session (TDD 5.2: id, role, fullName only)
export type SessionUser = {
  id: string;
  role: Role;
  fullName: string;
};

// 2. The three ways a request can be refused (TDD 5.3)
export type AuthErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND";

const STATUS: Record<AuthErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
};

const MESSAGES: Record<AuthErrorCode, string> = {
  UNAUTHENTICATED: "Please sign in to continue.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "Not found.",
};

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number;

  constructor(code: AuthErrorCode) {
    super(MESSAGES[code]);
    this.name = "AuthError";
    this.code = code;
    this.status = STATUS[code];
  }
}

// 3. Guard: the user must be signed in
export function requireUser(user: SessionUser | null | undefined): SessionUser {
  if (!user) throw new AuthError("UNAUTHENTICATED");
  return user;
}

// 4. Guard: the user's role must be allowed to do this action.
//    Returns the scope ("ALL", "ASSIGNED_ROUTES" or "OWN") for the next check.
export function requireRole(user: SessionUser | null | undefined, action: Action): Scope {
  const signedIn = requireUser(user);
  const scope = getScope(signedIn.role, action);
  if (!scope) throw new AuthError("FORBIDDEN");
  return scope;
}

// 5. Guard: readers and collectors may only touch subscribers on their assigned routes
export function requireRouteAccess(subscriberRouteId: string, assignedRouteIds: readonly string[]): void {
  if (!assignedRouteIds.includes(subscriberRouteId)) throw new AuthError("FORBIDDEN");
}

// 6. Guard: subscribers may only see their own records.
//    Answers NOT_FOUND (not FORBIDDEN) so nobody learns that the record exists.
export function requireSubscriberOwnership(user: SessionUser, recordOwnerUserId: string | null): void {
  if (recordOwnerUserId !== user.id) throw new AuthError("NOT_FOUND");
}

// 7. One call that applies the right check for the scope from requireRole()
export type RecordContext = {
  routeId: string; // the subscriber's collection route
  ownerUserId: string | null; // the subscriber's linked login account, if any
};

export function requireRecordAccess(
  scope: Scope,
  user: SessionUser,
  record: RecordContext,
  assignedRouteIds: readonly string[] = [],
): void {
  if (scope === "ALL") return;
  if (scope === "ASSIGNED_ROUTES") return requireRouteAccess(record.routeId, assignedRouteIds);
  return requireSubscriberOwnership(user, record.ownerUserId);
}

// 8. Turns an AuthError into the JSON error response from TDD 5.3
export function authErrorResponse(error: AuthError): Response {
  return Response.json(
    { success: false, error: { code: error.code, message: error.message } },
    { status: error.status },
  );
}