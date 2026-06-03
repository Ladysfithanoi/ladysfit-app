-- Session check-in / check-out anti-cheat tracking

-- CreateEnum
CREATE TYPE "WorkoutLogStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'VOID');

-- AlterTable: workout_logs gets lifecycle + timing + signature columns.
-- Existing rows default to COMPLETED so previously counted sessions stay counted.
ALTER TABLE "workout_logs"
  ADD COLUMN "status" "WorkoutLogStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "checkInAt" TIMESTAMP(3),
  ADD COLUMN "checkOutAt" TIMESTAMP(3),
  ADD COLUMN "firstInteractionAt" TIMESTAMP(3),
  ADD COLUMN "signatureUrl" TEXT,
  ADD COLUMN "voidReason" TEXT;

-- AlterTable: configurable minimum session duration (minutes)
ALTER TABLE "system_config"
  ADD COLUMN "minSessionMinutes" INTEGER NOT NULL DEFAULT 30;
