-- Thêm vai trò STAFF: nhân sự không dùng phần mềm quản lý (lao công, marketing,
-- lễ tân…). Đăng nhập chỉ để xem lương của chính mình; mọi màn quản lý đều từ
-- chối vì không danh sách cho phép nào có STAFF.
--
-- Tách riêng một migration vì Postgres không cho DÙNG một giá trị enum vừa thêm
-- ngay trong cùng giao dịch. Migration sau mới đặt nó làm mặc định cho cột mới.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STAFF';
