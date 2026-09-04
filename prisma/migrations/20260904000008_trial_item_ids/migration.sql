-- Bộ THẺ / HỒ SƠ đã bốc cho một lượt thi đề thử thách.
--
-- questionIds đang giữ bộ VÒNG đã bốc (7 vòng trong ngân hàng, mỗi lượt lấy 3).
-- Nay từng vòng cũng có ngân hàng riêng — 50 thẻ, mỗi lượt bốc 13 — nên phải
-- ghi lại luôn bộ thẻ đã phát, vì cùng một lý do: F5 không được bốc lại cho tới
-- khi ra bộ thẻ dễ, và lúc chấm phải chấm đúng những thẻ đã cho người ta thấy.
--
-- Để rỗng (dữ liệu cũ) = phát cả vòng, đúng lối trước khi có ngân hàng thẻ.
ALTER TABLE "exam_sessions" ADD COLUMN "trialItemIds" TEXT;
