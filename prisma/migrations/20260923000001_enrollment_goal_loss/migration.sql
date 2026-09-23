-- Mục tiêu giảm cân (kg) của một lộ trình L3/L4 — nhập ở phần chỉnh sửa lộ trình
-- trong hồ sơ khách. Khách giảm đủ số kg này trong thời hạn lộ trình thì PT được
-- thưởng transform 100.000đ. L1/L2 có ngưỡng cố định nên không dùng cột này.
ALTER TABLE "package_enrollments" ADD COLUMN IF NOT EXISTS "goalLossKg" DOUBLE PRECISION;
