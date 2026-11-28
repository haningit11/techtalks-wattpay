import { ZodError } from "zod";
import { auth } from "@/auth";
import { AuthError, authErrorResponse, requireRole } from "@/server/auth/guards";
import {
  ReadingReviewConflictError, ReadingReviewNotFoundError, ReadingReviewValidationError, resolveFlaggedReading,
} from "@/server/services/reading-review.service";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const user = (await auth())?.user;
    requireRole(user, "readings:review");
    let body: unknown;
    try { body = await request.json(); } catch { throw new ZodError([]); }
    const { id } = await context.params;
    const reading = await resolveFlaggedReading(user, id, body);
    return Response.json({ success: true, data: reading });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof ZodError) return Response.json({ success: false, error: {
      code: "INVALID_INPUT", message: error.issues[0]?.message ?? "Invalid request input.",
      ...(error.issues[0]?.path[0] === "reviewNote" ? { reason: "INVALID_REVIEW_NOTE" } : {}),
    } }, { status: 400 });
    if (error instanceof ReadingReviewValidationError) return Response.json({ success: false, error: {
      code: "VALIDATION_ERROR", reason: error.reason, message: error.message,
    } }, { status: 400 });
    if (error instanceof ReadingReviewNotFoundError) return Response.json({ success: false, error: {
      code: "NOT_FOUND", message: error.message,
    } }, { status: 404 });
    if (error instanceof ReadingReviewConflictError) return Response.json({ success: false, error: {
      code: "READING_CONFLICT", reason: error.reason, message: error.message,
    } }, { status: 409 });
    return Response.json({ success: false, error: {
      code: "INTERNAL_ERROR", message: "An unexpected error occurred.",
    } }, { status: 500 });
  }
}
