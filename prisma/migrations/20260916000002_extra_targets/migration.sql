-- Mục tiêu phát sinh — hạng mục nhân sự tự thêm cho riêng một tháng.
--
-- Bảy hạng mục cố định (doanh số, FIT, KH hợp tác, Transform, Google, CV, DS
-- Fitpartner) là Mục tiêu chủ chốt và nằm thẳng thành cột trong monthly_targets.
-- Mục tiêu phát sinh thêm bao nhiêu cũng được nên phải là bảng riêng.
--
-- Cách tính bám đúng mục tiêu chủ chốt: mục tiêu tháng ở đây, mục tiêu + thực
-- đạt từng tuần ở extra_target_weeks, và "Tháng đạt" luôn là TỔNG thực đạt các
-- tuần — không có ô thực đạt tháng riêng để hai con số không chỏi nhau.

CREATE TABLE IF NOT EXISTS "extra_targets" (
  "id"              TEXT NOT NULL,
  "monthlyTargetId" TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "unit"            TEXT,
  "isFloat"         BOOLEAN NOT NULL DEFAULT false,
  "order"           INTEGER NOT NULL DEFAULT 0,
  "monthTarget"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "extra_targets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "extra_targets_monthlyTargetId_idx"
  ON "extra_targets"("monthlyTargetId");

ALTER TABLE "extra_targets"
  DROP CONSTRAINT IF EXISTS "extra_targets_monthlyTargetId_fkey";
ALTER TABLE "extra_targets"
  ADD CONSTRAINT "extra_targets_monthlyTargetId_fkey"
  FOREIGN KEY ("monthlyTargetId") REFERENCES "monthly_targets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "extra_target_weeks" (
  "id"            TEXT NOT NULL,
  "extraTargetId" TEXT NOT NULL,
  "weekNumber"    INTEGER NOT NULL,
  "target"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "actual"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "extra_target_weeks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "extra_target_weeks_extraTargetId_weekNumber_key"
  ON "extra_target_weeks"("extraTargetId", "weekNumber");

ALTER TABLE "extra_target_weeks"
  DROP CONSTRAINT IF EXISTS "extra_target_weeks_extraTargetId_fkey";
ALTER TABLE "extra_target_weeks"
  ADD CONSTRAINT "extra_target_weeks_extraTargetId_fkey"
  FOREIGN KEY ("extraTargetId") REFERENCES "extra_targets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
