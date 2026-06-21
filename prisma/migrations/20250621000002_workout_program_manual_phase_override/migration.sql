-- PT có thể đổi giai đoạn thủ công; cờ này cho engine tự động biết để tôn trọng
-- lựa chọn của PT (không tự chèn lại giai đoạn thấp hơn).
ALTER TABLE "workout_programs"
  ADD COLUMN IF NOT EXISTS "manualPhaseOverride" BOOLEAN NOT NULL DEFAULT false;
