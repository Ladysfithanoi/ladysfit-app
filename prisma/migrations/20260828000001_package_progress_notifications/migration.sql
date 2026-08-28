-- Thông báo tiến độ lộ trình gửi FM: 3 mốc theo số buổi (50/70/90%) và 3 mốc
-- theo ngày tập (đã tập 2 tháng / còn 1 tháng / còn 2 tuần). Khoá duy nhất
-- (FM · lộ trình · mốc) đảm bảo mỗi mốc chỉ báo một lần dù cron chạy lại.
CREATE TYPE "PackageProgressMilestone" AS ENUM (
    'SESSIONS_50',
    'SESSIONS_70',
    'SESSIONS_90',
    'DAYS_2_MONTHS',
    'DAYS_1_MONTH_LEFT',
    'DAYS_2_WEEKS_LEFT'
);

CREATE TABLE "package_progress_notifications" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "clientId"     TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "milestone"    "PackageProgressMilestone" NOT NULL,
    "message"      TEXT NOT NULL,
    "isRead"       BOOLEAN NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_progress_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "package_progress_notifications_userId_enrollmentId_milestone_key"
    ON "package_progress_notifications"("userId", "enrollmentId", "milestone");

CREATE INDEX "package_progress_notifications_userId_isRead_idx"
    ON "package_progress_notifications"("userId", "isRead");

ALTER TABLE "package_progress_notifications"
    ADD CONSTRAINT "package_progress_notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "package_progress_notifications"
    ADD CONSTRAINT "package_progress_notifications_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "package_progress_notifications"
    ADD CONSTRAINT "package_progress_notifications_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "package_enrollments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
