-- Khách ưu tiên: lưu THỜI ĐIỂM bấm ưu tiên, không phải số thứ tự. "Chọn trước
-- thì lên trước" chính là xếp theo cột này, và bỏ ưu tiên một khách ở giữa cũng
-- không phải đánh số lại cả bảng.
ALTER TABLE "sales_leads" ADD COLUMN IF NOT EXISTS "prioritizedAt" TIMESTAMP(3);

-- Nhắc hẹn chăm sóc lại.
ALTER TABLE "sales_leads" ADD COLUMN IF NOT EXISTS "followUpAt"     TIMESTAMP(3);
ALTER TABLE "sales_leads" ADD COLUMN IF NOT EXISTS "followUpNote"   TEXT;
ALTER TABLE "sales_leads" ADD COLUMN IF NOT EXISTS "followUpById"   TEXT;
ALTER TABLE "sales_leads" ADD COLUMN IF NOT EXISTS "followUpDoneAt" TIMESTAMP(3);

-- Dòng nhắc trên đầu trang quét theo mốc hẹn.
CREATE INDEX IF NOT EXISTS "sales_leads_followUpAt_idx" ON "sales_leads"("followUpAt");
