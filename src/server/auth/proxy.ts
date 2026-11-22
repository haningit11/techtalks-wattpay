/** Prevents browser and proxy caching of protected routes after sign-out (TDD API-02). */
export const NO_STORE_CACHE_CONTROL =
  "private, no-store, no-cache, max-age=0, must-revalidate";

export interface ProxySessionDeps {
  getSessionUser?: () => Promise<{ id: string } | null>;
}

async function defaultGetSessionUser(): Promise<{ id: string } | null> {
  const { auth } = await import("@/auth");
  const session = await auth();

  return session?.user ?? null;
}

export type ProtectedProxyDecision =
  | { action: "redirect"; location: string; cacheControl: string }
  | { action: "next"; cacheControl: string };

/**
 * Evaluates a request to a protected role area: redirects signed-out visitors
 * to `/login` and enforces no-store cache headers on every response (TDD API-02, T-12).
 */
export async function evaluateProtectedProxyRequest(
  requestUrl: string,
  deps: ProxySessionDeps = {},
): Promise<ProtectedProxyDecision> {
  const getSessionUser = deps.getSessionUser ?? defaultGetSessionUser;
  const user = await getSessionUser();

  if (!user) {
    return {
      action: "redirect",
      location: new URL("/login", requestUrl).toString(),
      cacheControl: NO_STORE_CACHE_CONTROL,
    };
  }

  return {
    action: "next",
    cacheControl: NO_STORE_CACHE_CONTROL,
  };
}
