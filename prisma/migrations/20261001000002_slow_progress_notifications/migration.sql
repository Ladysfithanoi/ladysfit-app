-- Thông báo khách chậm tiến độ giảm cân cho FM của cơ sở + Admin.
CREATE TABLE IF NOT EXISTS "slow_progress_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "slow_progress_notifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "slow_progress_notifications_userId_alertId_key" ON "slow_progress_notifications"("userId", "alertId");
CREATE INDEX IF NOT EXISTS "slow_progress_notifications_userId_isRead_idx" ON "slow_progress_notifications"("userId", "isRead");
DO $$ BEGIN
  ALTER TABLE "slow_progress_notifications" ADD CONSTRAINT "slow_progress_notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "slow_progress_notifications" ADD CONSTRAINT "slow_progress_notifications_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "slow_progress_notifications" ADD CONSTRAINT "slow_progress_notifications_alertId_fkey"
    FOREIGN KEY ("alertId") REFERENCES "performance_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
