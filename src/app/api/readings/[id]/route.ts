import { ZodError } from "zod";
import { auth } from "@/auth";
import { AuthError, authErrorResponse, requireRole } from "@/server/auth/guards";
import { getMeterReadingById, ReadingNotFoundError } from "@/server/services/reading.service";

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
          message: error.issues[0]?.message ?? "Invalid reading ID.",
        },
      },
      { status: 400 },
    );
  }
  if (error instanceof ReadingNotFoundError) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: error.message } },
      { status: 404 },
    );
  }
  return Response.json(
    { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 },
  );
}

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const user = (await auth())?.user;
    requireRole(user, "readings:view");

    const { id } = await context.params;
    const reading = await getMeterReadingById(user, id);
    return Response.json({ success: true, data: reading });
  } catch (error) {
    return errorResponse(error);
  }
}
