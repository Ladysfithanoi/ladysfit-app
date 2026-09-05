-- Lối chơi thứ ba của đề thử thách: dựng giáo án buổi tập.
--
-- Tách riêng khỏi migration tạo bảng vì Postgres không cho DÙNG một giá trị enum
-- vừa thêm trong cùng một giao dịch. Đã vấp đúng chỗ này khi thêm ExamSin.
ALTER TYPE "ExamRoundType" ADD VALUE IF NOT EXISTS 'PROGRAM';
