-- Thông báo đẩy (Web Push): thiết bị đã đăng ký + đếm số lần nhắc ký check-out.
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");
DO $$ BEGIN
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "checkoutPushCount" INTEGER NOT NULL DEFAULT 0;
