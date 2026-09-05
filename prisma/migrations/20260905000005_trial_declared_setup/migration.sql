-- ĐỘ GẮT RIÊNG CỦA VÒNG ĐÃ KHAI trong đề thử thách.
--
-- Trước đây vòng của tội thí sinh tự khai chỉ khác vòng thường ở chỗ CHẤM: điểm
-- nhân đôi, ngưỡng đạt +15% (hằng số trong mã), sai số khay ăn co lại. Còn ở chỗ
-- CHƠI thì y hệt — mỗi thẻ sai vẫn mất 8/25 Thanh danh, chuỗi sai vẫn phạt theo
-- bảng chung.
--
-- Nhưng vòng khai là chỗ đắt nhất của cả kỳ: trượt nó là rớt, không bù được bằng
-- vòng nào khác. Chỗ đó xứng đáng có thang riêng, và ngưỡng đạt của nó là quyết
-- định vận hành của Admin chứ không phải một con số nằm trong mã nguồn.
--
-- Bỏ trống = dùng mặc định cũ, nên mọi cấp đang chạy không đổi gì.
ALTER TABLE "pt_levels"
  -- Ngưỡng đạt của vòng khai cộng thêm bấy nhiêu % (mặc định 15).
  ADD COLUMN "trialDeclaredPassBonus" INTEGER,
  -- Trần ngưỡng đạt của vòng khai (mặc định 95) — chặn cộng lên mức không ai qua.
  ADD COLUMN "trialDeclaredPassCap" INTEGER,
  -- Hao Thanh danh khi lệch một bậc ở vòng khai (mặc định 8).
  ADD COLUMN "trialDeclaredCostNear" INTEGER,
  -- Hao Thanh danh khi lệch hai bậc ở vòng khai (mặc định 25).
  ADD COLUMN "trialDeclaredCostFar" INTEGER,
  -- Bảng mốc phạt sai liên tiếp riêng cho vòng khai, cùng dạng JSON với
  -- trialStreakTiers. Bỏ trống = vòng khai dùng chung bảng của cấp (KHÔNG phải
  -- tắt phạt: bỏ trống một ô không bao giờ được làm bài thi dễ đi).
  ADD COLUMN "trialDeclaredStreakTiers" TEXT;
