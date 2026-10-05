-- Gói L0 được hoàn tiền: Admin/FM tích "Đã hoàn tiền" thì mọi buổi dạy của gói
-- đó không tính tiền buổi dạy cho PT (xem lib/session-pay.bucketOf).
ALTER TABLE "package_enrollments"
  ADD COLUMN IF NOT EXISTS "refunded" BOOLEAN NOT NULL DEFAULT false;
