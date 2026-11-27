import { ZodError } from "zod";
import { auth } from "@/auth";
import { AuthError, authErrorResponse, requireRole } from "@/server/auth/guards";
import {
  createSubscription,
  listSubscriptions,
  SubscriptionConflictError,
  SubscriptionNotFoundError,
  SubscriptionValidationError,
} from "@/server/services/subscription.service";

function errorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    return authErrorResponse(error);
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: error.issues[0]?.message ?? "Invalid request input.",
        },
      },
      { status: 400 },
    );
  }
  if (error instanceof SubscriptionValidationError) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: error.message } },
      { status: 400 },
    );
  }
  if (error instanceof SubscriptionNotFoundError) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: error.message } },
      { status: 404 },
    );
  }
  if (error instanceof SubscriptionConflictError) {
    return Response.json(
      {
        success: false,
        error: {
          code: "SUBSCRIPTION_CONFLICT",
          message: error.message,
          reason: error.reason,
        },
      },
      { status: 409 },
    );
  }
  return Response.json(
    {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    },
    { status: 500 },
  );
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = (await auth())?.user;
    requireRole(user, "setup:manage");

    const params = new URL(request.url).searchParams;
    const filters: Record<string, string> = Object.create(null);
    for (const [key, value] of params) {
      if (Object.hasOwn(filters, key)) {
        throw new ZodError([]);
      }
      filters[key] = value;
    }

    const subscriptions = await listSubscriptions(user, filters);
    return Response.json({ success: true, data: subscriptions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = (await auth())?.user;
    requireRole(user, "setup:manage");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ZodError([]);
    }

    const subscription = await createSubscription(user, body);
    return Response.json({ success: true, data: subscription }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
