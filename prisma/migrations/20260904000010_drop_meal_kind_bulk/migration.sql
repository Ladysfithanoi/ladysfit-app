-- Bỏ nhóm BULK khỏi hồ sơ khay ăn.
--
-- Phòng tập không nhận khách có mục tiêu tăng cân, nên một hồ sơ "khách muốn
-- lên 4kg" là tình huống không có thật ở đây và không đo được gì. Nhóm này thêm
-- vào hôm nay (20260904000009) và bỏ ngay trong ngày sau khi rà lại với chủ
-- phòng — giữ lại chỉ để đề sinh ra những hồ sơ không ai gặp ngoài sàn.
--
-- Postgres không xoá được một giá trị khỏi enum đang dùng, nên phải dựng lại
-- kiểu: đổi cột sang text, gộp BULK về CUT, thay kiểu mới rồi đổi cột trở lại.
ALTER TABLE "exam_meal_briefs" ALTER COLUMN "kind" TYPE TEXT;
UPDATE "exam_meal_briefs" SET "kind" = 'CUT' WHERE "kind" = 'BULK';
DROP TYPE "ExamMealKind";
CREATE TYPE "ExamMealKind" AS ENUM ('CUT', 'SPECIAL');
ALTER TABLE "exam_meal_briefs"
  ALTER COLUMN "kind" TYPE "ExamMealKind" USING "kind"::"ExamMealKind";
