-- Cấu hình ĐỀ THỬ THÁCH của từng cấp — trước đây là hằng số trong mã nguồn.
--
-- Bốn con số này quyết định một lượt thi dài bao nhiêu và gồm những gì. Để trong
-- mã thì mỗi lần muốn đổi độ dài bài thi lại phải sửa mã và deploy, trong khi đó
-- là quyết định vận hành của Admin — cùng loại với điểm đạt và số câu của đề trắc
-- nghiệm vốn đã nằm ở đây từ đầu.
--
-- Bỏ trống = dùng số mặc định trong lib/exam-trial.ts.
ALTER TABLE "pt_levels"
  -- Mỗi lượt thi bốc bao nhiêu đại tội.
  ADD COLUMN "trialRoundsPerAttempt" INTEGER,
  -- Trong số đó, bao nhiêu vòng là CASE STUDY (dựng khay ăn / dựng giáo án).
  -- Phần còn lại là vòng phân loại tình huống. Ví dụ 3 vòng với 1 case study =
  -- "1 câu case study + 2 câu hỏi thường".
  ADD COLUMN "trialCaseRounds" INTEGER,
  -- Số thẻ phát ra ở mỗi vòng phân loại.
  ADD COLUMN "trialCardsPerRound" INTEGER,
  -- Số hồ sơ phát ra ở mỗi vòng case study.
  ADD COLUMN "trialItemsPerCase" INTEGER;
