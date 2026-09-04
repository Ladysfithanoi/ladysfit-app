-- Chức vụ nhân sự do Admin tự quản (lao công, marketing, lễ tân…).
--
-- CỐ Ý không thêm giá trị vào enum Role. Role là QUYỀN: mọi kiểm tra quyền trong
-- app đều so theo nó, nên thêm giá trị mới lúc chạy sẽ sinh ra những người mà
-- không đoạn mã nào biết họ được làm gì. Chức vụ chỉ là nhãn nghề nghiệp —
-- hiện ở danh sách nhân sự, bảng lương, bộ lọc; không cấp quyền cho ai.

CREATE TABLE "job_positions" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "color"     TEXT NOT NULL DEFAULT '#6b7280',
    "order"     INTEGER NOT NULL DEFAULT 0,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_positions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_positions_name_key" ON "job_positions"("name");

ALTER TABLE "users" ADD COLUMN "jobPositionId" TEXT;

ALTER TABLE "users"
    ADD CONSTRAINT "users_jobPositionId_fkey"
    FOREIGN KEY ("jobPositionId") REFERENCES "job_positions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Mồi sẵn vài chức vụ thường gặp để Admin có cái mà dùng ngay; sửa/xoá được hết.
INSERT INTO "job_positions" ("id", "name", "color", "order") VALUES
  ('jp_hlv',       'Huấn luyện viên',  '#3b82f6', 0),
  ('jp_fm',        'Fitness Manager',  '#6366f1', 1),
  ('jp_letan',     'Lễ tân',           '#22c55e', 2),
  ('jp_marketing', 'Marketing',        '#a855f7', 3),
  ('jp_laocong',   'Lao công',         '#6b7280', 4),
  ('jp_ketoan',    'Kế toán',          '#eab308', 5)
ON CONFLICT ("name") DO NOTHING;
