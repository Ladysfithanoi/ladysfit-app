-- Convert set1Reps through set6Reps from Int to String in workout_set_logs
ALTER TABLE "workout_set_logs"
  ALTER COLUMN "set1Reps" TYPE TEXT USING "set1Reps"::TEXT,
  ALTER COLUMN "set2Reps" TYPE TEXT USING "set2Reps"::TEXT,
  ALTER COLUMN "set3Reps" TYPE TEXT USING "set3Reps"::TEXT,
  ALTER COLUMN "set4Reps" TYPE TEXT USING "set4Reps"::TEXT,
  ALTER COLUMN "set5Reps" TYPE TEXT USING "set5Reps"::TEXT,
  ALTER COLUMN "set6Reps" TYPE TEXT USING "set6Reps"::TEXT;
