-- Bộ số đo rút gọn: Vòng 2 (ngang rốn), Eo, Hông, Bắp tay, Đùi, Mông.
-- Thêm hai cột mới Hông và Mông. Các cột cũ không còn đo (armFromElbow,
-- thighFromKnee, calfSize, calfFromKnee) GIỮ NGUYÊN để không mất lịch sử đã đo.
ALTER TABLE "body_measurement_logs" ADD COLUMN IF NOT EXISTS "hip" DOUBLE PRECISION;
ALTER TABLE "body_measurement_logs" ADD COLUMN IF NOT EXISTS "glute" DOUBLE PRECISION;
