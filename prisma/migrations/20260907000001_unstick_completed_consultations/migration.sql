-- Buổi tư vấn COMPLETED mà không có hồ sơ khách hàng thì thực chất chưa hoàn
-- thành: xoá hồ sơ khách (DELETE /api/clients/[id]) có gỡ convertedClientId về
-- NULL nhưng để nguyên status = 'COMPLETED'. Buổi tư vấn đó thành chỉ-đọc vĩnh
-- viễn — không chốt được lộ trình, cũng không tạo lại được hồ sơ khách.
--
-- Trả những buổi đó về DRAFT để tư vấn viên làm tiếp. Không mất gì: chúng chưa
-- sinh ra hồ sơ khách hàng nào.
UPDATE consultations
SET status = 'DRAFT'
WHERE status = 'COMPLETED' AND "convertedClientId" IS NULL;
