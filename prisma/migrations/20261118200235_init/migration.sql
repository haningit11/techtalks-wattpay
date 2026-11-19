-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OPERATOR', 'METER_READER', 'PAYMENT_COLLECTOR', 'SUBSCRIBER');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "ReadingStatus" AS ENUM ('BASELINE', 'ACCEPTED', 'FLAGGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "fullName" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionRoute" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRouteAssignment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserRouteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" UUID NOT NULL,
    "fullName" VARCHAR(150) NOT NULL,
    "phoneNumber" VARCHAR(30) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "buildingId" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "userId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "subscriberId" UUID NOT NULL,
    "amperage" DECIMAL(6,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "SubscriptionStatus" NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "billingMonth" DATE NOT NULL,
    "previousReadingValue" DECIMAL(12,3),
    "submittedValue" DECIMAL(12,3) NOT NULL,
    "approvedValue" DECIMAL(12,3),
    "consumptionKwh" DECIMAL(12,3),
    "status" "ReadingStatus" NOT NULL,
    "flagReason" TEXT,
    "submittedByUserId" UUID NOT NULL,
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(6),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tariff" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "billingMonth" DATE NOT NULL,
    "ratePerKwh" DECIMAL(12,4) NOT NULL,
    "fixedFee" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "amperage" DECIMAL(6,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "meterReadingId" UUID NOT NULL,
    "tariffId" UUID NOT NULL,
    "billingMonth" DATE NOT NULL,
    "amperageSnapshot" DECIMAL(6,2) NOT NULL,
    "previousReadingSnapshot" DECIMAL(12,3) NOT NULL,
    "currentReadingSnapshot" DECIMAL(12,3) NOT NULL,
    "consumptionKwh" DECIMAL(12,3) NOT NULL,
    "ratePerKwh" DECIMAL(12,4) NOT NULL,
    "energyCharge" DECIMAL(12,2) NOT NULL,
    "fixedFee" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "BillStatus" NOT NULL,
    "generatedByUserId" UUID NOT NULL,
    "generatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "paymentDate" TIMESTAMP(6) NOT NULL,
    "receiptNumber" VARCHAR(50) NOT NULL,
    "recordedByUserId" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" UUID NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "description" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionRoute_name_key" ON "CollectionRoute"("name");

-- CreateIndex
CREATE INDEX "UserRouteAssignment_routeId_idx" ON "UserRouteAssignment"("routeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRouteAssignment_userId_routeId_key" ON "UserRouteAssignment"("userId", "routeId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_userId_key" ON "Subscriber"("userId");

-- CreateIndex
CREATE INDEX "Subscriber_buildingId_idx" ON "Subscriber"("buildingId");

-- CreateIndex
CREATE INDEX "Subscriber_routeId_idx" ON "Subscriber"("routeId");

-- CreateIndex
CREATE INDEX "Subscription_subscriberId_status_idx" ON "Subscription"("subscriberId", "status");

-- CreateIndex
CREATE INDEX "MeterReading_submittedByUserId_idx" ON "MeterReading"("submittedByUserId");

-- CreateIndex
CREATE INDEX "MeterReading_reviewedByUserId_idx" ON "MeterReading"("reviewedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MeterReading_subscriptionId_billingMonth_key" ON "MeterReading"("subscriptionId", "billingMonth");

-- CreateIndex
CREATE INDEX "Tariff_billingMonth_isActive_idx" ON "Tariff"("billingMonth", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Tariff_billingMonth_name_key" ON "Tariff"("billingMonth", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_meterReadingId_key" ON "Bill"("meterReadingId");

-- CreateIndex
CREATE INDEX "Bill_tariffId_idx" ON "Bill"("tariffId");

-- CreateIndex
CREATE INDEX "Bill_generatedByUserId_idx" ON "Bill"("generatedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_subscriptionId_billingMonth_key" ON "Bill"("subscriptionId", "billingMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "Payment_billId_idx" ON "Payment"("billId");

-- CreateIndex
CREATE INDEX "Payment_recordedByUserId_idx" ON "Payment"("recordedByUserId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "UserRouteAssignment" ADD CONSTRAINT "UserRouteAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRouteAssignment" ADD CONSTRAINT "UserRouteAssignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CollectionRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscriber" ADD CONSTRAINT "Subscriber_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscriber" ADD CONSTRAINT "Subscriber_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CollectionRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscriber" ADD CONSTRAINT "Subscriber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_meterReadingId_fkey" FOREIGN KEY ("meterReadingId") REFERENCES "MeterReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ================================================
-- WATTPAY DATABASE INTEGRITY CHECK CONSTRAINTS
-- ================================================

-- Subscription: amperage must be positive.
ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_amperage_positive_check"
CHECK ("amperage" > 0);

-- Subscription: end date cannot precede start date.
ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_dates_valid_check"
CHECK ("endDate" IS NULL OR "endDate" >= "startDate");


-- Meter Reading: values cannot be negative.
ALTER TABLE "MeterReading"
ADD CONSTRAINT "MeterReading_submitted_nonnegative_check"
CHECK ("submittedValue" >= 0);

ALTER TABLE "MeterReading"
ADD CONSTRAINT "MeterReading_previous_nonnegative_check"
CHECK ("previousReadingValue" IS NULL OR "previousReadingValue" >= 0);

ALTER TABLE "MeterReading"
ADD CONSTRAINT "MeterReading_approved_nonnegative_check"
CHECK ("approvedValue" IS NULL OR "approvedValue" >= 0);

ALTER TABLE "MeterReading"
ADD CONSTRAINT "MeterReading_consumption_nonnegative_check"
CHECK ("consumptionKwh" IS NULL OR "consumptionKwh" >= 0);


-- Tariff: prices and fees cannot be negative.
ALTER TABLE "Tariff"
ADD CONSTRAINT "Tariff_rate_nonnegative_check"
CHECK ("ratePerKwh" >= 0);

ALTER TABLE "Tariff"
ADD CONSTRAINT "Tariff_fixed_fee_nonnegative_check"
CHECK ("fixedFee" >= 0);

ALTER TABLE "Tariff"
ADD CONSTRAINT "Tariff_amperage_positive_check"
CHECK ("amperage" IS NULL OR "amperage" > 0);


-- Bill: historical billing values must be valid.
ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_amperage_positive_check"
CHECK ("amperageSnapshot" > 0);

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_readings_nonnegative_check"
CHECK (
  "previousReadingSnapshot" >= 0
  AND "currentReadingSnapshot" >= 0
  AND "consumptionKwh" >= 0
);

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_reading_order_check"
CHECK ("currentReadingSnapshot" >= "previousReadingSnapshot");

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_amounts_nonnegative_check"
CHECK (
  "ratePerKwh" >= 0
  AND "energyCharge" >= 0
  AND "fixedFee" >= 0
  AND "totalAmount" >= 0
);


-- Payment: recorded payment must be greater than zero.
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_amount_positive_check"
CHECK ("amount" > 0);
