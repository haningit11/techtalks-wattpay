import { createBuildingSchema } from "@/lib/validators/building.schema";
import { createBuilding, listBuildings } from "@/server/services/building.service";
import { handleApiError, ok, readJson, requirePermission } from "@/server/http";

// GET /api/buildings → list buildings
export async function GET() {
  try {
    await requirePermission("setup:manage");
    return ok(await listBuildings());
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/buildings → create a building
export async function POST(request: Request) {
  try {
    await requirePermission("setup:manage");
    const input = createBuildingSchema.parse(await readJson(request));
    return ok(await createBuilding(input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}