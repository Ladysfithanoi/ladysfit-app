-- Thanh danh khởi điểm — con số cuối cùng của vòng phân loại rời khỏi mã nguồn.
--
-- Mốc đầy 100 vốn là hằng số, và mọi chỗ vẽ thanh coi con số Thanh danh CHÍNH LÀ
-- phần trăm bề rộng. Giờ mốc đầy do Admin đặt nên chỗ vẽ phải chia cho mốc đầy
-- của vòng đang chơi — xem HonorRules.start trong lib/exam-trial.ts.
--
-- Đổi mốc đầy là đổi số lần sai chịu được, mà không phải đụng tới hao mỗi thẻ:
-- thanh 60 với hao 25 là hai lần lệch hai bậc đã cạn; thanh 150 thì sáu lần.
--
-- Vòng khai có ô riêng, bỏ trống thì KẾ THỪA mốc của vòng thường ở cùng cấp —
-- cùng lẽ với hai ô hao thẻ: vòng khai không bao giờ được dễ thở hơn vòng thường
-- chỉ vì một ô bỏ quên.
ALTER TABLE "pt_levels"
  ADD COLUMN "trialHonorStart" INTEGER,
  ADD COLUMN "trialDeclaredHonorStart" INTEGER;
