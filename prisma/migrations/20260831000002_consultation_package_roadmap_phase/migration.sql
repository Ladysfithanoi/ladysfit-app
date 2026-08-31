-- Bậc của gói trên bậc thang 3 giai đoạn ("Vẽ lộ trình tập").
-- Gói nào cũng ghép vào bậc nào cũng được, nên vị trí bậc phải lưu lại chứ
-- không suy ngược ra từ tên gói được nữa. NULL = lộ trình lưu từ trước khi có
-- bậc thang; lúc mở lại sẽ xếp tạm theo giai đoạn thương mại của gói.
ALTER TABLE "consultation_packages" ADD COLUMN "roadmapPhase" INTEGER;
