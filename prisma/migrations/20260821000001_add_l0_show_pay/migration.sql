-- Buổi dạy gói trải nghiệm "L0" (4 buổi / 2 triệu, 50.000đ/buổi) — tách riêng
-- khỏi ba bậc 35k (Cư dân) / 60k (L1,L2,Loyalfit) / 100k (L3,L4,L5).
ALTER TABLE "salary_records" ADD COLUMN "showsL0" INTEGER NOT NULL DEFAULT 0;
