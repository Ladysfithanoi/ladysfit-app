-- Nghỉ nửa ngày: chỉ bị trừ 0,5 ngày công thực tế (nghỉ thường trừ 1 ngày,
-- phép năm không trừ). Vì vậy ngày công thực tế và số ngày nghỉ đã áp vào bảng
-- lương phải chứa được số lẻ .5 → đổi từ INTEGER sang DOUBLE PRECISION.
ALTER TYPE "LeaveType" ADD VALUE IF NOT EXISTS 'HALF_DAY';

ALTER TABLE "salary_records" ALTER COLUMN "actualWorkDays" TYPE DOUBLE PRECISION;
ALTER TABLE "salary_records" ALTER COLUMN "leaveDays"      TYPE DOUBLE PRECISION;
