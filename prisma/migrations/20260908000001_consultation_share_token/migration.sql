-- Link chia sẻ màn "Tư vấn lộ trình" cho khách xem.
--
-- Token nằm ngay trên buổi tư vấn chứ không phải bảng riêng: một buổi tư vấn có
-- đúng một link, sinh ra lần đầu khi tư vấn viên bấm Chia sẻ rồi giữ nguyên —
-- gửi lại lần sau vẫn là link cũ, khách đã lưu link không bị hỏng.
--
-- NULL = chưa từng chia sẻ. UNIQUE để tra ngược token → buổi tư vấn, và để hai
-- buổi không bao giờ đụng token (khách vào link này lại thấy lộ trình người khác).
ALTER TABLE "consultations" ADD COLUMN "shareToken" TEXT;

CREATE UNIQUE INDEX "consultations_shareToken_key" ON "consultations"("shareToken");
