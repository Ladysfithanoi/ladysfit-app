-- Make weekly & monthly reports per-user instead of per-branch.
-- Existing branch-level rows are kept and attributed to whoever created them.

-- ── weekly_reports ───────────────────────────────────────────────────────────
ALTER TABLE "weekly_reports" ADD COLUMN IF NOT EXISTS "userId" TEXT;
UPDATE "weekly_reports" SET "userId" = "createdById" WHERE "userId" IS NULL;
ALTER TABLE "weekly_reports" ALTER COLUMN "userId" SET NOT NULL;

DROP INDEX IF EXISTS "weekly_reports_branchId_month_year_weekNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_reports_branchId_month_year_weekNumber_userId_key"
  ON "weekly_reports"("branchId", "month", "year", "weekNumber", "userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'weekly_reports_userId_fkey'
  ) THEN
    ALTER TABLE "weekly_reports"
      ADD CONSTRAINT "weekly_reports_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ── monthly_branch_reports ───────────────────────────────────────────────────
ALTER TABLE "monthly_branch_reports" ADD COLUMN IF NOT EXISTS "userId" TEXT;
UPDATE "monthly_branch_reports" SET "userId" = "createdById" WHERE "userId" IS NULL;
ALTER TABLE "monthly_branch_reports" ALTER COLUMN "userId" SET NOT NULL;

DROP INDEX IF EXISTS "monthly_branch_reports_branchId_month_year_key";
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_branch_reports_branchId_month_year_userId_key"
  ON "monthly_branch_reports"("branchId", "month", "year", "userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'monthly_branch_reports_userId_fkey'
  ) THEN
    ALTER TABLE "monthly_branch_reports"
      ADD CONSTRAINT "monthly_branch_reports_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
