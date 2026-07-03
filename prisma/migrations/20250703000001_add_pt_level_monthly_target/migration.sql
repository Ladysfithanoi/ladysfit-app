-- KPI doanh số/tháng (triệu) theo cấp độ PT — dùng để tính hiệu suất doanh số (hiệu suất = doanh số thực / KPI).
-- Mặc định 38tr cho mọi cấp độ hiện có; cấp "Thử việc" đặt 15tr.
-- Additive column; safe to apply on a live database.
ALTER TABLE "pt_levels" ADD COLUMN "monthlyTarget" INTEGER NOT NULL DEFAULT 38;

-- Tạo sẵn cấp độ "Thử việc" (KPI 15tr) nếu chưa có, xếp lên đầu danh sách.
INSERT INTO "pt_levels" ("id", "name", "order", "color", "retestIntervalDays", "monthlyTarget", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT
  'ptlevel_probation_seed',
  'Thử việc',
  COALESCE((SELECT MIN("order") FROM "pt_levels"), 1) - 1,
  '#6b7280',
  30,
  15,
  false,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "pt_levels" WHERE "name" = 'Thử việc');
