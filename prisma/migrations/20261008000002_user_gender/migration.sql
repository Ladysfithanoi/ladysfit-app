-- Giới tính nhân sự: lời chúc ngày phụ nữ cho nhân sự nữ + thống kê tỉ lệ giới tính.
DO $$ BEGIN
  CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" "Gender";
