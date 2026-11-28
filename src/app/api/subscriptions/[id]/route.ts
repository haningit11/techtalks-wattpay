import { ZodError } from "zod";
import { auth } from "@/auth";
import { AuthError, authErrorResponse, requireRole } from "@/server/auth/guards";
import {
  getSubscriptionById,
  SubscriptionConflictError,
  SubscriptionNotFoundError,
  SubscriptionValidationError,
  updateSubscription,
} from "@/server/services/subscription.service";

type Context = { params: Promise<{ id: string }> };

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
          message: error.issues[0]?.message ?? "Invalid subscription ID.",
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

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const user = (await auth())?.user;
    requireRole(user, "setup:manage");

    const { id } = await context.params;
    const subscription = await getSubscriptionById(user, id);
    return Response.json({ success: true, data: subscription });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const user = (await auth())?.user;
    requireRole(user, "setup:manage");

    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ZodError([]);
    }

    const subscription = await updateSubscription(user, id, body);
    return Response.json({ success: true, data: subscription });
  } catch (error) {
    return errorResponse(error);
  }
}
