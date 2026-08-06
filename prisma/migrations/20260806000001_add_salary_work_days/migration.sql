-- Ngày công: chuẩn = số ngày của tháng − số Chủ nhật (26–27 ngày), thực tế do FM nhập.
-- Lương cứng (lương CB + phụ cấp cố định) chia theo tỉ lệ thực tế / chuẩn.
ALTER TABLE "salary_records" ADD COLUMN "standardWorkDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "salary_records" ADD COLUMN "actualWorkDays"   INTEGER NOT NULL DEFAULT 0;
