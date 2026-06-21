-- Add LOCKED state to WorkoutProgramStatus (future phases not yet unlocked).
-- Additive enum change; safe to apply on a live database.
ALTER TYPE "WorkoutProgramStatus" ADD VALUE IF NOT EXISTS 'LOCKED';
