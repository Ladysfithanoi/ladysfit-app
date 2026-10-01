-- Lỗi giao diện phía trình duyệt (màn "Đã xảy ra lỗi") — để đọc được nguyên nhân.
CREATE TABLE IF NOT EXISTS "client_error_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "digest" TEXT,
    "url" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_error_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "client_error_logs_createdAt_idx" ON "client_error_logs"("createdAt");
