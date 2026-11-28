import { createAssignmentSchema } from "@/lib/validators/assignment.schema";
import { routeIdSchema } from "@/lib/validators/route.schema";
import { assignStaff, listAssignments } from "@/server/services/route.service";
import { handleApiError, ok, readJson, requirePermission } from "@/server/http";

// GET /api/route-assignments            → all assignments
// GET /api/route-assignments?routeId=…  → assignments of one route
export async function GET(request: Request) {
  try {
    await requirePermission("routes:assignStaff");
    const raw = new URL(request.url).searchParams.get("routeId");
    const routeId = raw ? routeIdSchema.parse(raw) : undefined;
    return ok(await listAssignments(routeId));
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/route-assignments → assign a Meter Reader / Collector to a route
export async function POST(request: Request) {
  try {
    const operator = await requirePermission("routes:assignStaff");
    const input = createAssignmentSchema.parse(await readJson(request));
    return ok(await assignStaff(input, operator.id), 201);
  } catch (error) {
    return handleApiError(error);
  }
}