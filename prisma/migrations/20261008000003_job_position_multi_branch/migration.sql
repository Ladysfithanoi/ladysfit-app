-- Chức vụ làm được nhiều cơ sở: một nhân sự gán nhiều cơ sở thay vì tạo trùng tài khoản.
ALTER TABLE "job_positions" ADD COLUMN IF NOT EXISTS "multiBranch" BOOLEAN NOT NULL DEFAULT false;
UPDATE "job_positions" SET "multiBranch" = true
 WHERE role = 'STAFF' AND (id IN ('jp_laocong', 'jp_marketing') OR name IN ('Lao công', 'Marketing'));
