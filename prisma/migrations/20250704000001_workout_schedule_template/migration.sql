-- Lịch tập mẫu: bài tập mặc định cho mỗi (giai đoạn, loại buổi, chuyển động).
-- Additive; an toàn khi chạy trên DB đang hoạt động.

CREATE TABLE "workout_schedule_templates" (
  "id"          TEXT NOT NULL,
  "phaseKey"    TEXT NOT NULL,
  "sessionType" TEXT NOT NULL,
  "movement"    TEXT NOT NULL,
  "exercise"    TEXT NOT NULL,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "workout_schedule_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workout_schedule_templates_phaseKey_sessionType_movement_key"
  ON "workout_schedule_templates" ("phaseKey", "sessionType", "movement");
