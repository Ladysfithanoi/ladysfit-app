-- Hao Thanh danh mỗi thẻ của VÒNG THƯỜNG, trước đây là hằng số trong mã.
--
-- Vòng đã khai vừa có hai ô này (xem 20260905000005), nên vòng thường không có
-- là lệch: Admin siết được chỗ đắt nhất mà không siết được thang nền của nó.
--
-- Bỏ trống = 8 và 25 như cũ. Vòng đã khai bỏ trống hai ô của nó thì KẾ THỪA hai
-- số này, không tụt về hằng gốc — nâng vòng thường lên 12/35 mà vòng khai hoá ra
-- nhẹ hơn thì cả cơ chế khai tội mất nghĩa.
ALTER TABLE "pt_levels"
  ADD COLUMN "trialCostNear" INTEGER,
  ADD COLUMN "trialCostFar" INTEGER;
