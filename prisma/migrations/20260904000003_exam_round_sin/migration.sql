-- Tách ĐẠI TỘI ra khỏi LỐI CHƠI của một vòng thi.
--
-- Trước đây chỉ có ExamRoundType (MEAL/SORT) và dropdown chọn lối chơi lại đi
-- hiện tên tội ("Phàm ăn", "Sa ngã"). Hệ quả: đổi tên vòng thì dropdown không
-- đổi theo, và "Sa ngã" vốn không nằm trong thất đại tội vẫn nằm chình ình ở đó.
--
-- Một đại tội có thể dùng lối chơi nào cũng được, và cùng một lối chơi phục vụ
-- được nhiều đại tội — nên đây là hai trường riêng.

CREATE TYPE "ExamSin" AS ENUM ('PRIDE', 'GREED', 'LUST', 'ENVY', 'GLUTTONY', 'WRATH', 'SLOTH');

ALTER TABLE "exam_rounds" ADD COLUMN "sin" "ExamSin";

-- Gán tội cho hai vòng đã có, theo đúng nội dung của chúng.
UPDATE "exam_rounds" SET "sin" = 'GLUTTONY' WHERE "type" = 'MEAL' AND "sin" IS NULL;
UPDATE "exam_rounds" SET "sin" = 'LUST'     WHERE "type" = 'SORT' AND "sin" IS NULL;

-- "Sa ngã" không phải một trong bảy đại tội — trả về đúng tên kinh điển.
UPDATE "exam_rounds" SET "name" = 'Dục vọng' WHERE "name" = 'Sa ngã';
