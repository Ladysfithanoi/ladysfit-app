-- Hai luật cuối của vòng khai rời khỏi mã nguồn: hệ số điểm, và "trượt là rớt".
--
-- Điểm nhân đôi và "trượt vòng khai là rớt cả kỳ" vốn là hằng số — nhưng đó là
-- hai cái nút chỉnh độ gắt mạnh nhất của cả kỳ thi, và độ gắt là quyết định vận
-- hành, không phải hằng số trong mã.
--
-- Bỏ trống = nhân 2 và BẬT luật rớt, đúng như trước. Tắt luật rớt phải là lựa
-- chọn có chủ ý: cơ chế khai tội sinh ra chính là để bắt buộc phải qua, tắt nó
-- thì vòng khai chỉ còn là một vòng nặng điểm hơn.
ALTER TABLE "pt_levels"
  ADD COLUMN "trialDeclaredMultiplier" INTEGER,
  ADD COLUMN "trialDeclaredMustPass" BOOLEAN;
