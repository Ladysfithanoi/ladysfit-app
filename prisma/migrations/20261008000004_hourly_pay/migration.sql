-- Lao công tính lương theo giờ: Số tiền/giờ × Số giờ làm.
ALTER TABLE "job_positions"   ADD COLUMN IF NOT EXISTS "hourlyPay"  BOOLEAN          NOT NULL DEFAULT false;
ALTER TABLE "salary_configs"  ADD COLUMN IF NOT EXISTS "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "salary_records"  ADD COLUMN IF NOT EXISTS "hourlyPay"  BOOLEAN          NOT NULL DEFAULT false;
ALTER TABLE "salary_records"  ADD COLUMN IF NOT EXISTS "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "salary_records"  ADD COLUMN IF NOT EXISTS "workHours"  DOUBLE PRECISION NOT NULL DEFAULT 0;
UPDATE "job_positions" SET "hourlyPay" = true
 WHERE role = 'STAFF' AND (id = 'jp_laocong' OR name = 'Lao công');
