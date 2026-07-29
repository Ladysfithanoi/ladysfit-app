-- Lịch thi cho đề thi thăng cấp: bật/tắt kỳ thi + đặt ngày và khung giờ được thi.
-- Ngày/giờ lưu dạng chuỗi theo giờ VN (UTC+7) để không lệch múi giờ server.
-- Additive; an toàn khi chạy trên DB đang hoạt động.

ALTER TABLE "exam_config" ADD COLUMN IF NOT EXISTS "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "exam_config" ADD COLUMN IF NOT EXISTS "examDate" TEXT;
ALTER TABLE "exam_config" ADD COLUMN IF NOT EXISTS "examStartTime" TEXT NOT NULL DEFAULT '00:00';
ALTER TABLE "exam_config" ADD COLUMN IF NOT EXISTS "examEndTime" TEXT NOT NULL DEFAULT '23:59';
