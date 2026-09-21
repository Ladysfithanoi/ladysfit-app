-- Ngày bắt đầu làm việc của nhân sự — mốc riêng, sống trên chính bản ghi nhân
-- sự thay vì đi nhờ bảng lương. Lịch nghỉ đọc mốc này.
ALTER TABLE "users" ADD COLUMN "employmentStartDate" TIMESTAMP(3);

-- Tách "Ngày nhận việc (BHXH)" cũ thành hai mốc: ngày làm chính thức (thâm
-- niên) và ngày nhận bảo hiểm. Dữ liệu cũ vốn là ngày nhận việc nên nhân đôi
-- sang cả hai, FM chỉnh lại sau.
ALTER TABLE "salary_configs" RENAME COLUMN "startDate" TO "officialStartDate";
ALTER TABLE "salary_configs" ADD COLUMN "insuranceStartDate" TIMESTAMP(3);
UPDATE "salary_configs" SET "insuranceStartDate" = "officialStartDate";

-- Giữ nguyên hành vi lịch nghỉ hiện tại: trước đây mốc vào làm lấy từ cấu hình
-- lương, thiếu thì lùi về ngày tạo tài khoản.
UPDATE "users" u
SET "employmentStartDate" = c."officialStartDate"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "officialStartDate"
  FROM "salary_configs"
  WHERE "officialStartDate" IS NOT NULL
  ORDER BY "userId", "effectiveFrom" DESC
) c
WHERE c."userId" = u."id";

UPDATE "users" SET "employmentStartDate" = "createdAt" WHERE "employmentStartDate" IS NULL;
