import { prisma } from "@/lib/prisma";
import type {
  CreateRouteInput,
  UpdateRouteInput,
} from "@/lib/validators/route.schema";
import {
  ASSIGNABLE_ROLES,
  type CreateAssignmentInput,
} from "@/lib/validators/assignment.schema";
import { ServiceError } from "./service-error";

/* ---------------- Routes ---------------- */

export function listRoutes() {
  return prisma.collectionRoute.findMany({ orderBy: { name: "asc" } });
}

export async function getRoute(id: string) {
  const route = await prisma.collectionRoute.findUnique({ where: { id } });
  if (!route) throw new ServiceError("NOT_FOUND", "Route not found.");
  return route;
}

export async function createRoute(data: CreateRouteInput) {
  const sameName = await prisma.collectionRoute.findUnique({
    where: { name: data.name },
  });
  if (sameName) {
    throw new ServiceError("CONFLICT", "A route with this name already exists.");
  }
  return prisma.collectionRoute.create({ data });
}

// Also used to deactivate/reactivate: send { isActive: false } or { isActive: true }
export async function updateRoute(id: string, data: UpdateRouteInput) {
  await getRoute(id);
  if (data.name) {
    const sameName = await prisma.collectionRoute.findUnique({
      where: { name: data.name },
    });
    if (sameName && sameName.id !== id) {
      throw new ServiceError("CONFLICT", "A route with this name already exists.");
    }
  }
  return prisma.collectionRoute.update({ where: { id }, data });
}

/* ---------------- Staff assignments ---------------- */

// All assignments (optionally for one route), with the staff member's name and role
export function listAssignments(routeId?: string) {
  return prisma.userRouteAssignment.findMany({
    where: routeId ? { routeId } : undefined,
    include: {
      user: { select: { id: true, fullName: true, role: true } },
      route: { select: { id: true, name: true } },
    },
    orderBy: { assignedAt: "desc" },
  });
}

// Assign a Meter Reader or Payment Collector to a route
export async function assignStaff(input: CreateAssignmentInput, actorId: string) {
  const { userId, routeId } = input;

  // 1. The user must exist, be active and have a staff role
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new ServiceError("NOT_FOUND", "User not found.");
  }
  if (!(ASSIGNABLE_ROLES as readonly string[]).includes(user.role)) {
    throw new ServiceError(
      "INVALID",
      "Only Meter Readers and Payment Collectors can be assigned to routes.",
    );
  }

  // 2. The route must exist and be active
  const route = await getRoute(routeId);
  if (!route.isActive) {
    throw new ServiceError("INVALID", "Inactive routes cannot receive new assignments.");
  }

  // 3. No duplicates: reactivate an old assignment instead of creating a second one
  const existing = await prisma.userRouteAssignment.findUnique({
    where: { userId_routeId: { userId, routeId } },
  });
  if (existing?.isActive) {
    throw new ServiceError("CONFLICT", "This staff member is already assigned to this route.");
  }

  // 4. Save the assignment and its audit entry together (both succeed or both fail)
  return prisma.$transaction(async (tx) => {
    const assignment = existing
      ? await tx.userRouteAssignment.update({
          where: { id: existing.id },
          data: { isActive: true },
        })
      : await tx.userRouteAssignment.create({ data: { userId, routeId } });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: existing ? "ASSIGNMENT_REACTIVATED" : "ASSIGNMENT_CREATED",
        entityType: "UserRouteAssignment",
        entityId: assignment.id,
        newValue: { userId, routeId, isActive: true },
      },
    });

    return assignment;
  });
}

// Activate or deactivate an existing assignment
export async function setAssignmentActive(id: string, isActive: boolean, actorId: string) {
  const existing = await prisma.userRouteAssignment.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("NOT_FOUND", "Assignment not found.");

  return prisma.$transaction(async (tx) => {
    const assignment = await tx.userRouteAssignment.update({
      where: { id },
      data: { isActive },
    });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: isActive ? "ASSIGNMENT_REACTIVATED" : "ASSIGNMENT_DEACTIVATED",
        entityType: "UserRouteAssignment",
        entityId: id,
        oldValue: { isActive: existing.isActive },
        newValue: { isActive },
      },
    });
    return assignment;
  });
}

// The route IDs a staff member may work on RIGHT NOW.
// Inactive assignments and inactive routes give NO access (Sprint 2 acceptance criterion).
export async function getActiveRouteIdsForUser(userId: string) {
  const rows = await prisma.userRouteAssignment.findMany({
    where: { userId, isActive: true, route: { isActive: true } },
    select: { routeId: true },
  });
  return rows.map((row) => row.routeId);
}

// Active staff that can be assigned to routes (for the assignment form)
export function listAssignableStaff() {
  return prisma.user.findMany({
    where: { isActive: true, role: { in: [...ASSIGNABLE_ROLES] } },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  });
}