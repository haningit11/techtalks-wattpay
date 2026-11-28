import { z } from "zod";

// Rules for CREATING a building (POST /api/buildings)
export const createBuildingSchema = z.object({
  name: z
    .string({ error: "Building name is required." })
    .trim()
    .min(1, "Building name is required.")
    .max(150, "Building name must be 150 characters or less."),
  address: z
    .string({ error: "Address is required." })
    .trim()
    .min(1, "Address is required.")
    .max(255, "Address must be 255 characters or less."),
  description: z.string().trim().optional(),
});

// Rules for UPDATING a building (PATCH /api/buildings/[id]):
// every field is optional, but at least one must be sent
export const updateBuildingSchema = createBuildingSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Send at least one field to update.",
  });

// The building ID in the URL must be a real UUID
export const buildingIdSchema = z.uuid("Invalid building ID.");

export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;