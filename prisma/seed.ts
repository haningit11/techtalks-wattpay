
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// ================================================
// DATABASE CONNECTION
// ================================================

const connectionString = process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL is missing.");
}

// ================================================
// DEMO PASSWORD VALIDATION
// ================================================

function getDemoPassword(): string {
  const password = process.env.SEED_DEMO_PASSWORD;

  if (!password || password.length < 12) {
    throw new Error(
      "SEED_DEMO_PASSWORD must contain at least 12 characters."
    );
  }

  return password;
}

// ================================================
// PRISMA CLIENT
// ================================================

const adapter = new PrismaPg({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
});

const prisma = new PrismaClient({ adapter });

// ================================================
// STABLE DEMO IDS
// ================================================

const ids = {
  operator: "00000000-0000-4000-8000-000000000001",
  reader: "00000000-0000-4000-8000-000000000002",
  collector: "00000000-0000-4000-8000-000000000003",
  subscriberUser: "00000000-0000-4000-8000-000000000004",

  building: "10000000-0000-4000-8000-000000000001",
  route: "20000000-0000-4000-8000-000000000001",

  subscribers: [
    "30000000-0000-4000-8000-000000000001",
    "30000000-0000-4000-8000-000000000002",
    "30000000-0000-4000-8000-000000000003",
    "30000000-0000-4000-8000-000000000004",
    "30000000-0000-4000-8000-000000000005",
  ],

  subscriptions: [
    "40000000-0000-4000-8000-000000000001",
    "40000000-0000-4000-8000-000000000002",
    "40000000-0000-4000-8000-000000000003",
    "40000000-0000-4000-8000-000000000004",
    "40000000-0000-4000-8000-000000000005",
  ],

  readings: [
    "50000000-0000-4000-8000-000000000001",
    "50000000-0000-4000-8000-000000000002",
    "50000000-0000-4000-8000-000000000003",
    "50000000-0000-4000-8000-000000000004",
    "50000000-0000-4000-8000-000000000005",
  ],

  tariff: "60000000-0000-4000-8000-000000000001",
  tariff10A: "60000000-0000-4000-8000-000000000002",

  assignments: [
    "70000000-0000-4000-8000-000000000001",
    "70000000-0000-4000-8000-000000000002",
  ],
};

// ================================================
// MAIN SEED FUNCTION
// ================================================

async function main() {
  // 1. Hash the shared development demo password.
  const demoPassword = getDemoPassword();

  const passwordHash: string = await bcrypt.hash(
    demoPassword,
    12
  );

  // 2. Verify the database connection before inserting.
  const databaseCheck = await prisma.$queryRaw<
    Array<{ database: string; schema: string }>
  >`
    SELECT
      current_database() AS database,
      current_schema() AS schema
  `;

  console.log(
    "Seed database connection verified:",
    databaseCheck[0]
  );

  // ==============================================
  // 3. CREATE FOUR DEMO USER ACCOUNTS
  // ==============================================

  const users = [
    {
      id: ids.operator,
      fullName: "WattPay Demo Operator",
      email: "operator@wattpay.local",
      role: "OPERATOR" as const,
    },
    {
      id: ids.reader,
      fullName: "WattPay Demo Reader",
      email: "reader@wattpay.local",
      role: "METER_READER" as const,
    },
    {
      id: ids.collector,
      fullName: "WattPay Demo Collector",
      email: "collector@wattpay.local",
      role: "PAYMENT_COLLECTOR" as const,
    },
    {
      id: ids.subscriberUser,
      fullName: "Subscriber S2",
      email: "s2@wattpay.local",
      role: "SUBSCRIBER" as const,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        ...user,
        passwordHash,
        isActive: true,
      },
    });
  }

  // ==============================================
  // 4. CREATE BUILDING
  // ==============================================

  await prisma.building.upsert({
    where: { id: ids.building },
    update: {},
    create: {
      id: ids.building,
      name: "Building Al-Nour",
      address: "Demo Address - Lebanon",
      description: "Synthetic WattPay acceptance-test building",
    },
  });

  // ==============================================
  // 5. CREATE COLLECTION ROUTE
  // ==============================================

  await prisma.collectionRoute.upsert({
    where: { id: ids.route },
    update: {},
    create: {
      id: ids.route,
      name: "Route A",
      description: "Building Al-Nour demo route",
      isActive: true,
    },
  });

  // ==============================================
  // 6. ASSIGN READER AND COLLECTOR TO ROUTE A
  // ==============================================

  const assignments = [
    {
      id: ids.assignments[0],
      userId: ids.reader,
    },
    {
      id: ids.assignments[1],
      userId: ids.collector,
    },
  ];

  for (const assignment of assignments) {
    await prisma.userRouteAssignment.upsert({
      where: {
        userId_routeId: {
          userId: assignment.userId,
          routeId: ids.route,
        },
      },
      update: {},
      create: {
        ...assignment,
        routeId: ids.route,
        isActive: true,
      },
    });
  }

  // ==============================================
  // 7. CREATE FIVE SUBSCRIBERS
  // ==============================================

  const subscriberData = [
    {
      name: "Subscriber S1",
      phone: "+96170000001",
      amperage: "10.00",
      previous: "1200.000",
    },
    {
      name: "Subscriber S2",
      phone: "+96170000002",
      amperage: "5.00",
      previous: "2000.000",
    },
    {
      name: "Subscriber S3",
      phone: "+96170000003",
      amperage: "10.00",
      previous: "500.000",
    },
    {
      name: "Subscriber S4",
      phone: "+96170000004",
      amperage: "5.00",
      previous: "3100.000",
    },
    {
      name: "Subscriber S5",
      phone: "+96170000005",
      amperage: "5.00",
      previous: "900.000",
    },
  ];

  const october = new Date("2026-10-01T00:00:00.000Z");

  for (let i = 0; i < subscriberData.length; i++) {
    const data = subscriberData[i];

    const subscriberId = ids.subscribers[i];
    const subscriptionId = ids.subscriptions[i];
    const readingId = ids.readings[i];

    // Only S2 has a subscriber portal login.
    const userId = i === 1 ? ids.subscriberUser : null;

    // Create subscriber.
    await prisma.subscriber.upsert({
      where: { id: subscriberId },
      update: {},
      create: {
        id: subscriberId,
        fullName: data.name,
        phoneNumber: data.phone,
        address: `Unit ${i + 1}, Building Al-Nour`,
        buildingId: ids.building,
        routeId: ids.route,
        userId,
        isActive: true,
      },
    });

    // Create electricity subscription.
    await prisma.subscription.upsert({
      where: { id: subscriptionId },
      update: {},
      create: {
        id: subscriptionId,
        subscriberId,
        amperage: data.amperage,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        status: "ACTIVE",
      },
    });

    // Create October baseline reading.
    await prisma.meterReading.upsert({
      where: { id: readingId },
      update: {},
      create: {
        id: readingId,
        subscriptionId,
        billingMonth: october,
        previousReadingValue: null,
        submittedValue: data.previous,
        approvedValue: data.previous,
        consumptionKwh: null,
        status: "BASELINE",
        submittedByUserId: ids.operator,
      },
    });
  }

  // ==============================================
  // 8. CREATE NOVEMBER TARIFFS
  // ==============================================

  const november = new Date("2026-11-01T00:00:00.000Z");

  await prisma.tariff.upsert({
    where: { id: ids.tariff },
    update: {},
    create: {
      id: ids.tariff,
      name: "Standard November 2026",
      billingMonth: november,
      ratePerKwh: "0.4500",
      fixedFee: "10.00",
      currency: "USD",
      amperage: "5.00",
      isActive: true,
      createdByUserId: ids.operator,
    },
  });

  await prisma.tariff.upsert({
    where: { id: ids.tariff10A },
    update: {},
    create: {
      id: ids.tariff10A,
      name: "10A November 2026",
      billingMonth: november,
      ratePerKwh: "0.5000",
      fixedFee: "15.00",
      currency: "USD",
      amperage: "10.00",
      isActive: true,
      createdByUserId: ids.operator,
    },
  });

  // ==============================================
  // 9. SEED SUMMARY
  // ==============================================

  console.log("\nWattPay synthetic seed completed!");

  console.log("Created or found:");
  console.log("- 4 demo user accounts");
  console.log("- 1 building");
  console.log("- 1 collection route");
  console.log("- 2 staff route assignments");
  console.log("- 5 subscribers");
  console.log("- 5 electricity subscriptions");
  console.log("- 5 October baseline readings");
  console.log("- 2 November tariffs (5A and 10A)");

  console.log("\nNo November bills or payments were created.");
}

// ================================================
// EXECUTION AND CLEANUP
// ================================================

main()
  .catch((error) => {
    console.error("WattPay seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
