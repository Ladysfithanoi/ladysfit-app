-- Split session counting: check-in signature deducts the client's package,
-- check-out signature counts the PT's teaching session (salary).

ALTER TABLE "workout_logs" ADD COLUMN "checkInSignatureUrl" TEXT;
ALTER TABLE "workout_logs" ADD COLUMN "packageCounted" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every COMPLETED log was already counted against the package under
-- the old flow, so mark it as counted. This keeps delete/void reversal correct.
UPDATE "workout_logs" SET "packageCounted" = true WHERE "status" = 'COMPLETED';
