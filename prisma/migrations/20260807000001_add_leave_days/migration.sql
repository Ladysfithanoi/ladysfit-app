-- Lịch nghỉ: mỗi dòng là một ngày nhân sự tích nghỉ trên lịch.
-- Số ngày nghỉ trong tháng (bỏ Chủ nhật) được trừ vào ngày công thực tế của
-- bảng lương tháng đó.
CREATE TABLE "leave_days" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "date"        DATE NOT NULL,
    "note"        TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leave_days_userId_date_key" ON "leave_days"("userId", "date");

CREATE INDEX "leave_days_userId_date_idx" ON "leave_days"("userId", "date");

ALTER TABLE "leave_days"
    ADD CONSTRAINT "leave_days_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_days"
    ADD CONSTRAINT "leave_days_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Số ngày nghỉ đã áp vào bảng lương ở lần tính gần nhất, để khi lịch nghỉ đổi
-- chỉ trừ thêm phần chênh lệch và giữ nguyên ngày công FM sửa tay.
ALTER TABLE "salary_records" ADD COLUMN "leaveDays" INTEGER NOT NULL DEFAULT 0;
