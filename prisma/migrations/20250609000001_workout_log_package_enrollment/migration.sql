-- Record which package enrollment each session was charged against at check-in,
-- so delete/void reverses the exact same lộ trình even when the client has more
-- than one active package (renewal before the previous package is finished).
ALTER TABLE "workout_logs" ADD COLUMN "packageEnrollmentId" TEXT;
