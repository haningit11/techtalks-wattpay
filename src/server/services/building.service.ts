import { prisma } from "@/lib/prisma";
import type {
  CreateBuildingInput,
  UpdateBuildingInput,
} from "@/lib/validators/building.schema";
import { ServiceError } from "./service-error";

// All buildings, sorted by name
export function listBuildings() {
  return prisma.building.findMany({ orderBy: { name: "asc" } });
}

// One building, or a NOT_FOUND error
export async function getBuilding(id: string) {
  const building = await prisma.building.findUnique({ where: { id } });
  if (!building) throw new ServiceError("NOT_FOUND", "Building not found.");
  return building;
}

export function createBuilding(data: CreateBuildingInput) {
  return prisma.building.create({ data });
}

export async function updateBuilding(id: string, data: UpdateBuildingInput) {
  await getBuilding(id); // throws NOT_FOUND if it doesn't exist
  return prisma.building.update({ where: { id }, data });
}