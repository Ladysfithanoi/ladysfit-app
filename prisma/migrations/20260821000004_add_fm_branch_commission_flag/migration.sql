-- FM: dòng lương này có hưởng hoa hồng doanh số cả phòng không. Mặc định có, để
-- các bảng lương đã tạo (cơ sở một FM) giữ nguyên cách tính cũ.
ALTER TABLE "salary_records" ADD COLUMN "branchCommission" BOOLEAN NOT NULL DEFAULT true;
