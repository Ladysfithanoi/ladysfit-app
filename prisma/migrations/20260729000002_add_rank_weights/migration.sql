-- Trọng số (%) cho 3 tiêu chí xếp hạng: điểm thi, doanh số TB, số transform.
-- Admin chỉnh trong De thi > Cau hinh; tong 3 tri so luon bang 100.
-- Additive; an toàn khi chạy trên DB đang hoạt động.

ALTER TABLE "exam_config" ADD COLUMN IF NOT EXISTS "rankWeightExam" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "exam_config" ADD COLUMN IF NOT EXISTS "rankWeightRevenue" INTEGER NOT NULL DEFAULT 40;
ALTER TABLE "exam_config" ADD COLUMN IF NOT EXISTS "rankWeightTransform" INTEGER NOT NULL DEFAULT 30;
