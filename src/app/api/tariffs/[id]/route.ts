import { z, ZodError } from "zod";
import { auth } from "@/auth";
import { updateTariffSchema } from "@/lib/validators/tariff.schema";
import { AuthError, authErrorResponse, requireRole } from "@/server/auth/guards";
import { activateTariff, deactivateTariff, getTariffById, TariffConflictError, updateTariff } from "@/server/services/tariff.service";

type Context = { params: Promise<{ id: string }> };
const idSchema = z.uuid();
const statusSchema = z.strictObject({ isActive: z.boolean() });
const patchSchema = z.union([updateTariffSchema, statusSchema]);

function errorResponse(error: unknown): Response {
  if (error instanceof AuthError) return authErrorResponse(error);
  if (error instanceof ZodError) return Response.json({ success: false, error: { code: "INVALID_INPUT", message: "Invalid request input." } }, { status: 400 });
  if (error instanceof TariffConflictError) return Response.json({ success: false, error: { code: "TARIFF_CONFLICT", message: error.message, reason: error.reason } }, { status: 409 });
  return Response.json({ success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }, { status: 500 });
}

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const user = (await auth())?.user;
    requireRole(user, "tariffs:manage");
    const id = idSchema.parse((await context.params).id);
    const tariff = await getTariffById(user, id);
    return Response.json({ success: true, data: tariff });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const user = (await auth())?.user;
    requireRole(user, "tariffs:manage");
    const id = idSchema.parse((await context.params).id);
    let body: unknown;
    try { body = await request.json(); } catch { throw new ZodError([]); }
    const parsed = patchSchema.parse(body);
    const tariff = "isActive" in parsed
      ? parsed.isActive ? await activateTariff(user, id) : await deactivateTariff(user, id)
      : await updateTariff(user, id, body);
    return Response.json({ success: true, data: tariff });
  } catch (error) {
    return errorResponse(error);
  }
}
