-- Đợt "Thanh toán nốt" sinh ra từ một lead Đặt cọc.
--
-- Khách đặt cọc xong, phần còn nợ được thu ở một đợt sau. Trước đây phải gõ tay
-- lại toàn bộ thông tin khách thành một lead mới; giờ bấm một nút là có bản sao,
-- và cột này ghi lại lead cọc gốc của nó.
--
-- Có giá trị = dòng này LÀ đợt thu nốt: tình trạng khoá cứng ở PB (Thanh toán
-- nốt), không đổi sang tình trạng khác được.
--
-- Cố tình KHÔNG đặt khoá ngoại: xoá lead cọc gốc thì đợt thu nốt vẫn phải là
-- đợt thu nốt, không được âm thầm mở khoá tình trạng.

ALTER TABLE "sales_leads" ADD COLUMN IF NOT EXISTS "payoffOfId" TEXT;

CREATE INDEX IF NOT EXISTS "sales_leads_payoffOfId_idx" ON "sales_leads"("payoffOfId");
