import { buildingIdSchema, updateBuildingSchema } from "@/lib/validators/building.schema";
import { getBuilding, updateBuilding } from "@/server/services/building.service";
import { handleApiError, ok, readJson, requirePermission } from "@/server/http";

type Context = { params: Promise<{ id: string }> };

// GET /api/buildings/[id] → one building
export async function GET(_request: Request, { params }: Context) {
  try {
    await requirePermission("setup:manage");
    const id = buildingIdSchema.parse((await params).id);
    return ok(await getBuilding(id));
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/buildings/[id] → update a building
export async function PATCH(request: Request, { params }: Context) {
  try {
    await requirePermission("setup:manage");
    const id = buildingIdSchema.parse((await params).id);
    const input = updateBuildingSchema.parse(await readJson(request));
    return ok(await updateBuilding(id, input));
  } catch (error) {
    return handleApiError(error);
  }
}