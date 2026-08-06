-- Admin/FM chỉnh tay "Số buổi PT" của một lộ trình. Phần chênh lệch so với số
-- đếm tự động từ workout_logs được ghi theo (lộ trình · tháng sửa) và cộng vào
-- tiền buổi dạy của tháng đó.
CREATE TABLE "pt_session_adjustments" (
    "id"           TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "ptId"         TEXT NOT NULL,
    "month"        INTEGER NOT NULL,
    "year"         INTEGER NOT NULL,
    "delta"        INTEGER NOT NULL,
    "createdById"  TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pt_session_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pt_session_adjustments_enrollmentId_month_year_key"
    ON "pt_session_adjustments"("enrollmentId", "month", "year");

CREATE INDEX "pt_session_adjustments_ptId_month_year_idx"
    ON "pt_session_adjustments"("ptId", "month", "year");

ALTER TABLE "pt_session_adjustments"
    ADD CONSTRAINT "pt_session_adjustments_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "package_enrollments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pt_session_adjustments"
    ADD CONSTRAINT "pt_session_adjustments_ptId_fkey"
    FOREIGN KEY ("ptId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
