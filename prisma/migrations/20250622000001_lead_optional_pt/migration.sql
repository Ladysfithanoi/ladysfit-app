-- Cho phép lead không gắn nhân sự phụ trách (PT đã nghỉ việc, import lịch sử từ Excel).
-- Doanh thu của các lead này vẫn tính vào tổng doanh thu phòng tập nhưng không chia cho PT nào.
ALTER TABLE "sales_leads" ALTER COLUMN "assignedPTId" DROP NOT NULL;
