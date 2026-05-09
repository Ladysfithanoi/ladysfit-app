-- Add LEAD_REMINDER value to ChecklistNotifType enum.
-- IF NOT EXISTS makes this safe to run even if it was already added via db push.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'LEAD_REMINDER'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ChecklistNotifType')
  ) THEN
    ALTER TYPE "ChecklistNotifType" ADD VALUE 'LEAD_REMINDER';
  END IF;
END $$;
