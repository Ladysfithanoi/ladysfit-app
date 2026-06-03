-- Client-side session confirmation (anti-forgery: client confirms on their own app)

-- Add new lifecycle state: PT finished, waiting for the client to confirm.
ALTER TYPE "WorkoutLogStatus" ADD VALUE IF NOT EXISTS 'AWAITING_CONFIRMATION';

-- How a session was confirmed.
CREATE TYPE "WorkoutConfirmMethod" AS ENUM ('CLIENT_APP', 'SIGNATURE');

ALTER TABLE "workout_logs"
  ADD COLUMN "confirmationMethod" "WorkoutConfirmMethod",
  ADD COLUMN "confirmedAt" TIMESTAMP(3);
