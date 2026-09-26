-- Xác minh thiết bị khi đăng nhập: máy lạ phải nhập mã gửi về email.
CREATE TABLE IF NOT EXISTS "trusted_devices" (
    "id" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "trusted_devices_accountType_accountId_deviceHash_key" ON "trusted_devices"("accountType", "accountId", "deviceHash");
CREATE INDEX IF NOT EXISTS "trusted_devices_accountType_accountId_idx" ON "trusted_devices"("accountType", "accountId");

CREATE TABLE IF NOT EXISTS "login_otps" (
    "id" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_otps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "login_otps_accountType_accountId_deviceHash_idx" ON "login_otps"("accountType", "accountId", "deviceHash");
