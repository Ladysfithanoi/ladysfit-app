-- Tự lưu đáp án trong lúc làm bài.
--
-- Trước đây đáp án chỉ tồn tại trong trình duyệt cho tới lúc bấm nộp: hết giờ
-- mà nộp hỏng, mất mạng, sập trình duyệt hay hết pin là mất trắng cả bài. Cột
-- này giữ bài đang làm dở ở máy chủ để chấm lại được.
ALTER TABLE "exam_sessions" ADD COLUMN "answers" TEXT;
