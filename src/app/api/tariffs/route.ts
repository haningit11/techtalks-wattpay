import { ZodError } from "zod";
import { auth } from "@/auth";
import { createTariffSchema, listTariffsSchema } from "@/lib/validators/tariff.schema";
import { AuthError, authErrorResponse, requireRole } from "@/server/auth/guards";
import { createTariff, listTariffs, TariffConflictError } from "@/server/services/tariff.service";

function errorResponse(error: unknown): Response {
  if (error instanceof AuthError) return authErrorResponse(error);
  if (error instanceof ZodError) return Response.json({ success: false, error: { code: "INVALID_INPUT", message: "Invalid request input." } }, { status: 400 });
  if (error instanceof TariffConflictError) return Response.json({ success: false, error: { code: "TARIFF_CONFLICT", message: error.message, reason: error.reason } }, { status: 409 });
  return Response.json({ success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }, { status: 500 });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = (await auth())?.user;
    requireRole(user, "tariffs:manage");
    const params = new URL(request.url).searchParams;
    const filters: Record<string, unknown> = Object.create(null);
    for (const [key, value] of params) {
      if (Object.hasOwn(filters, key)) throw new ZodError([]);
      filters[key] = key === "isActive" && (value === "true" || value === "false") ? value === "true" : value;
    }
    listTariffsSchema.parse(filters);
    const tariffs = await listTariffs(user, filters);
    return Response.json({ success: true, data: tariffs });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = (await auth())?.user;
    requireRole(user, "tariffs:manage");
    let body: unknown;
    try { body = await request.json(); } catch { throw new ZodError([]); }
    createTariffSchema.parse(body);
    const tariff = await createTariff(user, body);
    return Response.json({ success: true, data: tariff }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
