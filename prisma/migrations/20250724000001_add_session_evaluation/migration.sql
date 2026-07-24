-- Đánh giá buổi tập (autoregulation): PT làm bảng đánh giá 3 trục trước khi ký
-- check-out; từ đó sinh gợi ý điều chỉnh tải cho buổi sau.
-- Additive; an toàn khi chạy trên DB đang hoạt động.

ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "surveyPerformance" TEXT;
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "surveyRirFeel" TEXT;
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "surveyRecovery" TEXT;
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "nextSessionSuggestion" TEXT;
