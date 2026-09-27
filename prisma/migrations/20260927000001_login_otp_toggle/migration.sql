-- Mỗi tài khoản tự bật/tắt xác minh máy lạ bằng mã email (mặc định bật).
ALTER TABLE "users"   ADD COLUMN IF NOT EXISTS "loginOtpEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "loginOtpEnabled" BOOLEAN NOT NULL DEFAULT true;
