
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  // Test the database connection.
  const result = await prisma.$queryRaw<
    Array<{ database: string; schema: string }>
  >`
    SELECT
      current_database() AS database,
      current_schema() AS schema
  `;

  console.log("Prisma Client connection successful!");
  console.log(result[0]);

  // Test access to the WattPay Subscriber table.
  const subscriberCount = await prisma.$queryRaw<
    Array<{ total: bigint }>
  >`
    SELECT COUNT(*)::bigint AS total
    FROM public."Subscriber"
  `;

  console.log(
    "Subscribers accessible:",
    subscriberCount[0].total.toString()
  );
}

main()
  .catch((error) => {
    console.error("Prisma Client test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
