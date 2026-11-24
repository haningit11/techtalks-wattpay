-- Review and coordinate this migration before applying it to any database.
-- Lock the table so the checks and constraints see a consistent set of tariffs.
BEGIN;
LOCK TABLE "Tariff" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Tariff"
    WHERE "id" = '60000000-0000-4000-8000-000000000001'::uuid
      AND "amperage" IS NOT NULL
      AND "amperage" <> 5.00
  ) THEN
    RAISE EXCEPTION 'Tariff migration stopped: existing tariff has an unexpected amperage and requires manual review.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Tariff"
    WHERE "amperage" IS NULL
      AND "id" <> '60000000-0000-4000-8000-000000000001'::uuid
  ) THEN
    RAISE EXCEPTION 'Tariff migration stopped: unexpected null amperage; coordinate data correction before retrying.';
  END IF;

  -- Include the approved 5A backfill in the duplicate check before changing data.
  IF EXISTS (
    SELECT 1 FROM "Tariff"
    GROUP BY "billingMonth", CASE
      WHEN "id" = '60000000-0000-4000-8000-000000000001'::uuid
        AND "amperage" IS NULL THEN 5.00
      ELSE "amperage"
    END
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Tariff migration stopped: duplicate billing month and amperage, including the proposed 5A backfill; coordinate data correction before retrying.';
  END IF;
END $$;

UPDATE "Tariff"
SET "amperage" = 5.00
WHERE "id" = '60000000-0000-4000-8000-000000000001'::uuid
  AND "amperage" IS NULL;

ALTER TABLE "Tariff" ALTER COLUMN "amperage" SET NOT NULL;
CREATE UNIQUE INDEX "Tariff_billingMonth_amperage_key" ON "Tariff"("billingMonth", "amperage");
COMMIT;
