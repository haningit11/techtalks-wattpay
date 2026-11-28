import { createRouteSchema } from "@/lib/validators/route.schema";
import { createRoute, listRoutes } from "@/server/services/route.service";
import { handleApiError, ok, readJson, requirePermission } from "@/server/http";

// GET /api/routes → list routes
export async function GET() {
  try {
    await requirePermission("setup:manage");
    return ok(await listRoutes());
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/routes → create a route
export async function POST(request: Request) {
  try {
    await requirePermission("setup:manage");
    const input = createRouteSchema.parse(await readJson(request));
    return ok(await createRoute(input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}