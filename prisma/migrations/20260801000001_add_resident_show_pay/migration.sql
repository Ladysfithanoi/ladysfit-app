-- Buổi dạy gói tài trợ "Cư dân" (35.000đ/buổi) — tách riêng khỏi hai bậc 60k/100k
ALTER TABLE "salary_records" ADD COLUMN "showsResident" INTEGER NOT NULL DEFAULT 0;
