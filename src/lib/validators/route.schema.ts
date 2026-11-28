import { z } from "zod";

// Rules for CREATING a route (POST /api/routes)
export const createRouteSchema = z.object({
  name: z
    .string({ error: "Route name is required." })
    .trim()
    .min(1, "Route name is required.")
    .max(150, "Route name must be 150 characters or less."),
  description: z.string().trim().optional(),
});

// Rules for UPDATING a route (PATCH /api/routes/[id]):
// same fields, plus isActive so the Operator can deactivate or reactivate it
export const updateRouteSchema = createRouteSchema
  .extend({
    isActive: z.boolean({ error: "isActive must be true or false." }),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Send at least one field to update.",
  });

export const routeIdSchema = z.uuid("Invalid route ID.");

export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;