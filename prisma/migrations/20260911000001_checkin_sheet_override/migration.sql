-- Sửa tay phiếu check-in — lớp phủ đặt LÊN TRÊN dữ liệu thật.
--
-- Khách tập từ trước khi có app thì trong máy chỉ còn những buổi ghi sau ngày
-- app ra đời: trên giấy khách đã hết buổi, còn phiếu in ra thì trống hơn một
-- nửa. Phụ lục hợp đồng phải khớp thực tế, nên FM/PT cần điền tay buổi cũ và
-- sửa lại các ô ghi sai.
--
-- Không một ô nào ở bảng này ghi ngược vào workout_logs hay package_enrollments:
-- buổi ghi tay không có nhật ký, không chữ ký, không ảnh — không phải buổi dạy
-- hợp lệ, nên không được chạm vào "Số buổi PT" lẫn hạn lộ trình.
--
-- Mặc định TẮT: Admin bật ở Cài đặt → Cấp độ PT.

ALTER TABLE "system_config"
  ADD COLUMN IF NOT EXISTS "enableCheckinSheetEdit" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "checkin_sheet_overrides" (
  "id"           TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "header"       TEXT,
  "rows"         TEXT,
  "extraRows"    TEXT,
  "updatedById"  TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "checkin_sheet_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "checkin_sheet_overrides_enrollmentId_key"
  ON "checkin_sheet_overrides"("enrollmentId");

ALTER TABLE "checkin_sheet_overrides"
  DROP CONSTRAINT IF EXISTS "checkin_sheet_overrides_enrollmentId_fkey";
ALTER TABLE "checkin_sheet_overrides"
  ADD CONSTRAINT "checkin_sheet_overrides_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "package_enrollments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checkin_sheet_overrides"
  DROP CONSTRAINT IF EXISTS "checkin_sheet_overrides_updatedById_fkey";
ALTER TABLE "checkin_sheet_overrides"
  ADD CONSTRAINT "checkin_sheet_overrides_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
