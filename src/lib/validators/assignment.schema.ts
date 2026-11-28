import { z } from "zod";

// Only these roles can be assigned to a route (TDD 4.1.4)
export const ASSIGNABLE_ROLES = ["METER_READER", "PAYMENT_COLLECTOR"] as const;

// Rules for ASSIGNING staff to a route (POST /api/route-assignments)
export const createAssignmentSchema = z.object({
  userId: z.uuid("Invalid user ID."),
  routeId: z.uuid("Invalid route ID."),
});

// Rules for activating/deactivating an assignment (PATCH /api/route-assignments/[id])
export const updateAssignmentSchema = z.object({
  isActive: z.boolean({ error: "isActive must be true or false." }),
});

export const assignmentIdSchema = z.uuid("Invalid assignment ID.");

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;