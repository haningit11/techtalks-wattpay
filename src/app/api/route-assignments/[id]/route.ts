import { assignmentIdSchema, updateAssignmentSchema } from "@/lib/validators/assignment.schema";
import { setAssignmentActive } from "@/server/services/route.service";
import { handleApiError, ok, readJson, requirePermission } from "@/server/http";

type Context = { params: Promise<{ id: string }> };

// PATCH /api/route-assignments/[id] → { "isActive": false } deactivates, true reactivates
export async function PATCH(request: Request, { params }: Context) {
  try {
    const operator = await requirePermission("routes:assignStaff");
    const id = assignmentIdSchema.parse((await params).id);
    const { isActive } = updateAssignmentSchema.parse(await readJson(request));
    return ok(await setAssignmentActive(id, isActive, operator.id));
  } catch (error) {
    return handleApiError(error);
  }
}