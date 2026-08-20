-- Engine tự động cũ ghi thẳng câu "Tự động tạo khi chuyển sang Giai đoạn N…" vào
-- cột notes của chương trình nó tự dựng. Câu đó hiện trên thẻ chương trình ở tab
-- CT Tập, nên sau khi bỏ engine thì người dùng vẫn đọc thấy "tự động" dù không
-- còn gì chạy tự động nữa.
--
-- Đổi lại đúng câu mà luồng chuyển giai đoạn THỦ CÔNG đang dùng; phần "PT vui
-- lòng chọn bài tập" giữ nguyên vì vẫn đúng với các CT chưa điền bài.
UPDATE "workout_programs"
SET "notes" = replace("notes", 'Tự động tạo khi chuyển sang', 'Tạo khi chuyển sang')
WHERE "notes" LIKE 'Tự động tạo khi chuyển sang%';
