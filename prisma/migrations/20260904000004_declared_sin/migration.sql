-- Thí sinh TỰ KHAI một đại tội trước khi được xem đề.
--
-- Không phải chọn thế mạnh mà là nhận mình yếu ở đâu: vòng của tội đã khai sẽ
-- khó hơn, điểm nhân đôi, và bắt buộc phải qua — không bù bằng các vòng khác.
--
-- Khai xong là chốt. Cho đổi lại thì người ta xem đề rồi mới khai, và cả cơ chế
-- mất sạch ý nghĩa. Vì vậy đề chỉ được gửi xuống SAU khi đã khai.

ALTER TABLE "exam_sessions" ADD COLUMN "declaredSin" "ExamSin";
ALTER TABLE "exam_attempts" ADD COLUMN "declaredSin" "ExamSin";
