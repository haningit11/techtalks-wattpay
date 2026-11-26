import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createTariffSchema, listTariffsSchema, updateTariffSchema } from "@/lib/validators/tariff.schema";
import { AuthError, requireRole, requireUser, type SessionUser } from "@/server/auth/guards";

type User = SessionUser | null | undefined;

export class TariffConflictError extends Error {
  constructor(message: string, readonly reason: "DUPLICATE" | "HISTORICAL_PRICING" = "DUPLICATE") {
    super(message);
    this.name = "TariffConflictError";
  }
}

function handleUniqueError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new TariffConflictError("A tariff with this billing month and amperage or name already exists.");
  }
  throw error;
}

export async function createTariff(user: User, input: unknown) {
  requireRole(user, "tariffs:manage");
  const operator = requireUser(user);
  const data = createTariffSchema.parse(input);
  try {
    return await prisma.tariff.create({ data: { ...data, createdByUserId: operator.id } });
  } catch (error) {
    return handleUniqueError(error);
  }
}

export async function listTariffs(user: User, filters: unknown = {}) {
  requireRole(user, "tariffs:manage");
  const where = listTariffsSchema.parse(filters);
  return prisma.tariff.findMany({ where, orderBy: [{ billingMonth: "desc" }, { amperage: "asc" }] });
}

export async function getTariffById(user: User, id: string) {
  requireRole(user, "tariffs:manage");
  const tariff = await prisma.tariff.findUnique({ where: { id } });
  if (!tariff) throw new AuthError("NOT_FOUND");
  return tariff;
}

export async function updateTariff(user: User, id: string, input: unknown) {
  requireRole(user, "tariffs:manage");
  const data = updateTariffSchema.parse(input);
  try {
    return await prisma.$transaction(async (tx) => {
      // A row lock also conflicts with the foreign-key lock taken by a new Bill.
      // Check for bills after acquiring it and hold it until the update commits.
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Tariff" WHERE "id" = ${id}::uuid FOR UPDATE`;
      if (rows.length === 0) throw new AuthError("NOT_FOUND");
      const current = await tx.tariff.findUniqueOrThrow({ where: { id } });
      const changesHistoricalFields =
        (data.billingMonth !== undefined && data.billingMonth.getTime() !== current.billingMonth.getTime()) ||
        (data.amperage !== undefined && !data.amperage.eq(current.amperage)) ||
        (data.ratePerKwh !== undefined && !data.ratePerKwh.eq(current.ratePerKwh)) ||
        (data.fixedFee !== undefined && !data.fixedFee.eq(current.fixedFee)) ||
        (data.currency !== undefined && data.currency !== current.currency);
      if (changesHistoricalFields && await tx.bill.count({ where: { tariffId: id } }) > 0) {
        throw new TariffConflictError("A tariff referenced by a bill cannot have its billing month, amperage, or pricing changed.", "HISTORICAL_PRICING");
      }
      return tx.tariff.update({ where: { id }, data });
    });
  } catch (error) {
    return handleUniqueError(error);
  }
}

export async function deactivateTariff(user: User, id: string) {
  requireRole(user, "tariffs:manage");
  // updateMany avoids a read/update race and preserves existing bill references.
  const result = await prisma.tariff.updateMany({ where: { id }, data: { isActive: false } });
  if (result.count === 0) throw new AuthError("NOT_FOUND");
  return prisma.tariff.findUniqueOrThrow({ where: { id } });
}

export async function activateTariff(user: User, id: string) {
  requireRole(user, "tariffs:manage");
  const result = await prisma.tariff.updateMany({ where: { id }, data: { isActive: true } });
  if (result.count === 0) throw new AuthError("NOT_FOUND");
  return prisma.tariff.findUniqueOrThrow({ where: { id } });
}
