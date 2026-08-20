-- Chuyển giai đoạn tập giờ là thao tác THỦ CÔNG: không còn engine tự đặt chương
-- trình của giai đoạn sau về trạng thái LOCKED. Dữ liệu cũ còn CT ở LOCKED thì
-- đưa về ARCHIVED — chúng vẫn hiện trong mục "chương trình đã lưu trữ" và được
-- dùng lại khi ai đó bấm chuyển sang giai đoạn tương ứng.
--
-- Giá trị LOCKED vẫn được giữ trong enum WorkoutProgramStatus: gỡ một giá trị
-- enum của Postgres phải dựng lại cả kiểu, không đáng để đánh đổi rủi ro. Code
-- không còn sinh ra giá trị này nữa.
UPDATE "workout_programs" SET "status" = 'ARCHIVED' WHERE "status" = 'LOCKED';
