-- Khách hàng chuyển giao — khách từ cơ sở Ladysfit khác chuyển về.
--
-- Lộ trình của họ giống hệt khách thường: chọn được đủ mọi gói, không xét điều
-- kiện cân nặng cho L1/L2 (giai đoạn 1 họ đã đi ở cơ sở cũ), giá gói và doanh
-- số vẫn như thường. Khác đúng MỘT thứ: tiền một buổi dạy trả cho PT luôn là
-- 50.000đ, bất kể gói nào.
ALTER TYPE "ContractType" ADD VALUE IF NOT EXISTS 'TRANSFER';

-- Buổi dạy khách chuyển giao — 50.000đ/buổi, nằm riêng một rổ để tiền buổi dạy
-- không bị tính theo đơn giá của gói.
ALTER TABLE "salary_records"
  ADD COLUMN IF NOT EXISTS "showsTransfer" INTEGER NOT NULL DEFAULT 0;
