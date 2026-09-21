-- Chốt ngày làm việc: nhân sự bấm Check-out khi xong việc. Check-list đã tự lưu
-- suốt ngày nên mốc này không phải "đã lưu" mà là "tôi làm xong rồi, mời quản
-- lý đọc" — chính nó bắn thông báo sang FM.
ALTER TABLE "daily_checklists" ADD COLUMN IF NOT EXISTS "checkedOutAt" TIMESTAMP(3);

-- Đánh giá của FM sau khi đọc tự luận cuối ngày.
ALTER TABLE "daily_checklists" ADD COLUMN IF NOT EXISTS "fmRating"     INTEGER;
ALTER TABLE "daily_checklists" ADD COLUMN IF NOT EXISTS "fmComment"    TEXT;
ALTER TABLE "daily_checklists" ADD COLUMN IF NOT EXISTS "fmReviewedAt" TIMESTAMP(3);
ALTER TABLE "daily_checklists" ADD COLUMN IF NOT EXISTS "fmReviewerId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_checklists_fmReviewerId_fkey'
  ) THEN
    ALTER TABLE "daily_checklists"
      ADD CONSTRAINT "daily_checklists_fmReviewerId_fkey"
      FOREIGN KEY ("fmReviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "daily_checklists_fmReviewerId_idx" ON "daily_checklists"("fmReviewerId");

-- Thông báo gửi FM khi một nhân sự chốt ngày.
-- IF NOT EXISTS giữ an toàn nếu giá trị đã được thêm bằng db push.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'CHECKOUT'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ChecklistNotifType')
  ) THEN
    ALTER TYPE "ChecklistNotifType" ADD VALUE 'CHECKOUT';
  END IF;
END $$;
