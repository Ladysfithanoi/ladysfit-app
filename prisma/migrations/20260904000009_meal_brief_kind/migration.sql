-- Nhóm của một hồ sơ khay ăn.
--
-- Ngân hàng hồ sơ nay lớn hơn số hồ sơ phát ra (khoảng 50, mỗi lượt phát 3), nên
-- bốc bừa thì có lượt ra cả ba khách đều muốn giảm cân — mất sạch cái bẫy vốn là
-- linh hồn của vòng này: phản xạ cắt calo cho bất kỳ ai bước vào phòng tập.
--
-- Chia nhóm để mỗi lượt luôn có đủ ba dạng (xem TRIAL_BRIEF_MIX):
--   CUT        — khách giảm cân, dạng phổ biến nhất.
--   BULK       — khách cần TĂNG calo: gầy muốn lên cân, hoặc đang xây cơ.
--   SPECIAL    — có ràng buộc bắt buộc: dị ứng, bệnh nền, thai kỳ, ăn chay.
--
-- Để rỗng thì coi như CUT — dữ liệu cũ không vì thế mà hỏng.
CREATE TYPE "ExamMealKind" AS ENUM ('CUT', 'BULK', 'SPECIAL');
ALTER TABLE "exam_meal_briefs" ADD COLUMN "kind" "ExamMealKind";
