-- Weekly check-list report: send-to-FM marker + AI-drafted flag.

-- New notification type so an FM is told when a staff member sends their week.
-- IF NOT EXISTS keeps this safe if the value was already added via db push.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'WEEKLY_REPORT'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ChecklistNotifType')
  ) THEN
    ALTER TYPE "ChecklistNotifType" ADD VALUE 'WEEKLY_REPORT';
  END IF;
END $$;

ALTER TABLE "weekly_monthly_reports" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "weekly_monthly_reports" ADD COLUMN IF NOT EXISTS "aiGenerated" BOOLEAN NOT NULL DEFAULT false;
