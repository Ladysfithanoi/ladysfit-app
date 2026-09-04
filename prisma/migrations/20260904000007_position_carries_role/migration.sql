-- Gộp "Vai trò" và "Chức vụ" thành MỘT ô khi thêm nhân sự.
--
-- Trước đây Admin phải điền hai ô cho cùng một người: Vai trò (quyền) và Chức vụ
-- (nhãn nghề nghiệp). Đúng về mặt kỹ thuật nhưng bắt người dùng tự ghép hai thứ
-- lại — không đáng.
--
-- Giờ mỗi CHỨC VỤ mang theo QUYỀN của nó. Admin chọn một ô, quyền đi kèm. Quyền
-- vẫn là enum cố định: Admin chọn TỪ danh sách có sẵn chứ không đặt ra quyền mới.

ALTER TABLE "job_positions" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'STAFF';

-- Các chức vụ đã mồi sẵn: gán đúng quyền tương ứng.
UPDATE "job_positions" SET "role" = 'PT' WHERE "name" = 'Huấn luyện viên';
UPDATE "job_positions" SET "role" = 'FM' WHERE "name" = 'Fitness Manager';
-- Lễ tân / Marketing / Lao công / Kế toán giữ STAFF (mặc định).

-- Bổ sung chức vụ cho các vai trò quản lý, để ô chức vụ duy nhất phủ hết mọi người.
INSERT INTO "job_positions" ("id", "name", "color", "order", "role") VALUES
  ('jp_admin', 'Admin',          '#a855f7', 10, 'ADMIN'),
  ('jp_coo',   'COO',            '#f97316', 11, 'COO'),
  ('jp_ceofp', 'CEO Fitpartner', '#eab308', 12, 'CEO_FITPARTNER')
ON CONFLICT ("name") DO NOTHING;

-- Gán chức vụ cho nhân sự đang có, suy từ quyền hiện tại của họ. Nhờ vậy mở form
-- sửa lên là ô chức vụ đã đúng sẵn, không ai phải chọn lại từ đầu.
UPDATE "users" u
SET "jobPositionId" = p."id"
FROM "job_positions" p
WHERE u."jobPositionId" IS NULL
  AND p."role" = u."role"
  AND p."name" IN ('Huấn luyện viên', 'Fitness Manager', 'Admin', 'COO', 'CEO Fitpartner');
