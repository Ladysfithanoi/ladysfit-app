-- Thời lượng mỗi thí sinh được làm bài (phút). Khác với khung giờ thi: khung giờ
-- là lúc phòng thi mở cửa, còn đây là thời gian được ngồi làm kể từ lúc mở đề.
-- 0 = không giới hạn.
ALTER TABLE "exam_config" ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 0;
