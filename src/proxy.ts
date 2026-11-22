import { NextResponse, type NextRequest } from "next/server";
import { evaluateProtectedProxyRequest } from "@/server/auth/proxy";

export async function proxy(request: NextRequest) {
  const decision = await evaluateProtectedProxyRequest(request.url);

  const response =
    decision.action === "redirect"
      ? NextResponse.redirect(decision.location)
      : NextResponse.next();

  // Prevent browser back/forward cache from showing protected views after sign-out (TDD API-02).
  response.headers.set("Cache-Control", decision.cacheControl);
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/reader/:path*", "/collector/:path*", "/portal/:path*"],
};
