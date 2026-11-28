import { routeIdSchema, updateRouteSchema } from "@/lib/validators/route.schema";
import { getRoute, updateRoute } from "@/server/services/route.service";
import { handleApiError, ok, readJson, requirePermission } from "@/server/http";

type Context = { params: Promise<{ id: string }> };

// GET /api/routes/[id] → one route
export async function GET(_request: Request, { params }: Context) {
  try {
    await requirePermission("setup:manage");
    const id = routeIdSchema.parse((await params).id);
    return ok(await getRoute(id));
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/routes/[id] → update, deactivate ({ "isActive": false }) or reactivate
export async function PATCH(request: Request, { params }: Context) {
  try {
    await requirePermission("setup:manage");
    const id = routeIdSchema.parse((await params).id);
    const input = updateRouteSchema.parse(await readJson(request));
    return ok(await updateRoute(id, input));
  } catch (error) {
    return handleApiError(error);
  }
}