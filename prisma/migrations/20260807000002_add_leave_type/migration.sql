-- Phân loại ngày nghỉ: phép năm (ANNUAL) vẫn hưởng đủ lương, nghỉ thường
-- (UNPAID) bị trừ ngày công. Các ngày đã tích trước đây đều là nghỉ thường.
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'UNPAID');

ALTER TABLE "leave_days" ADD COLUMN "type" "LeaveType" NOT NULL DEFAULT 'UNPAID';
