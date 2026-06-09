-- Client can approve ending a live session early (khách có việc, chỉ tập được
-- 30' nhưng vẫn đồng ý tính buổi). When set, the PT may check out and count the
-- teaching session without the usual min-duration / 6-exercise gates.
ALTER TABLE "workout_logs" ADD COLUMN "earlyEndApprovedAt" TIMESTAMP(3);
