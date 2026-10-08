-- Lộ trình L0: tick 5 lỗi kỹ thuật theo bài, đánh giá nội bộ Buổi 3.
ALTER TABLE "workout_set_logs" ADD COLUMN IF NOT EXISTS "faults" TEXT;
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "l0Assessment" TEXT;

-- Khách chấm điểm buổi tập + nhận xét.
CREATE TABLE IF NOT EXISTS "session_ratings" (
    "id" TEXT NOT NULL,
    "workoutLogId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ptId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_ratings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "session_ratings_workoutLogId_key" ON "session_ratings"("workoutLogId");
CREATE INDEX IF NOT EXISTS "session_ratings_branchId_createdAt_idx" ON "session_ratings"("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "session_ratings_ptId_createdAt_idx" ON "session_ratings"("ptId", "createdAt");
ALTER TABLE "session_ratings" ADD CONSTRAINT "session_ratings_workoutLogId_fkey" FOREIGN KEY ("workoutLogId") REFERENCES "workout_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_ratings" ADD CONSTRAINT "session_ratings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_ratings" ADD CONSTRAINT "session_ratings_ptId_fkey" FOREIGN KEY ("ptId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_ratings" ADD CONSTRAINT "session_ratings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
