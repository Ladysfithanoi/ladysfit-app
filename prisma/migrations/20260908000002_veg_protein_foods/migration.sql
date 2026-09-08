-- Seitan và tempeh cho thực đơn chay.
--
-- Bảng foods đang có đậu phụ và nấm nhưng thiếu hẳn hai nguồn đạm chay mạnh
-- nhất. Chế độ chay xoá toàn bộ thịt/cá/hải sản khỏi bảng gửi cho AI, nên nếu
-- không bổ sung thì thực đơn chay chỉ còn đậu phụ — bữa nào cũng đậu phụ, và
-- rất khó đạt đủ protein.
--
-- Tên đặt kèm cả tên Việt lẫn tên quốc tế để khách gõ kiểu nào cũng khớp, và để
-- lọt vào nhóm "đạm thực vật" ở app/api/nutrition/generate-plan (nhóm này khớp
-- theo các tiếng "seitan", "mì căn", "tempeh", "đậu nành").
--
-- Số liệu trên 100g:
--   Seitan (mì căn) chín : 141 kcal · 25.0 P · 14.0 C · 1.9 F
--   Tempeh           : 192 kcal · 20.3 P ·  7.6 C · 10.8 F
--
-- WHERE NOT EXISTS để chạy lại không đẻ ra bản trùng.
INSERT INTO "foods" ("name", "calories", "protein", "carbs", "fat", "weight_g", "updatedAt")
SELECT 'Mì căn (seitan)', 141, 25.0, 14.0, 1.9, 100, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "foods" WHERE "name" = 'Mì căn (seitan)');

INSERT INTO "foods" ("name", "calories", "protein", "carbs", "fat", "weight_g", "updatedAt")
SELECT 'Tempeh (đậu nành lên men)', 192, 20.3, 7.6, 10.8, 100, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "foods" WHERE "name" = 'Tempeh (đậu nành lên men)');
