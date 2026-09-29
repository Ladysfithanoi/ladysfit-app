-- FM/Admin tính buổi dạy cho buổi PT sơ suất không chụp được ảnh check-out.
ALTER TYPE "WorkoutConfirmMethod" ADD VALUE IF NOT EXISTS 'FM_APPROVAL';
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "creditedById" TEXT;
