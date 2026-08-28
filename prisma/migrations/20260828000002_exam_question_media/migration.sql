-- Ảnh / video minh hoạ cho câu hỏi kiểm tra. Cả hai đều tuỳ chọn: câu hỏi có
-- thể chỉ có chữ (như toàn bộ câu hỏi cũ), hoặc kèm ảnh, kèm video, hoặc cả hai.
ALTER TABLE "exam_questions" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "exam_questions" ADD COLUMN "videoUrl" TEXT;
