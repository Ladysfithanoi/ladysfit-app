-- Điều kiện thăng hạng theo cấp độ + bài kiểm tra thực hành (rubric FM chấm).
-- Tất cả đều additive; an toàn khi chạy trên DB đang hoạt động.

-- 1) Ngưỡng doanh số / transform để thăng lên cấp kế tiếp (đặt trên cấp HIỆN TẠI).
ALTER TABLE "pt_levels" ADD COLUMN "promoteMinAvgRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "pt_levels" ADD COLUMN "promoteMinTransform" INTEGER NOT NULL DEFAULT 0;

-- 2) Ngưỡng % đạt bài kiểm tra thực hành.
ALTER TABLE "system_config" ADD COLUMN "practicalPassPercent" INTEGER NOT NULL DEFAULT 70;

-- 3) Bảng lưu kết quả chấm thực hành.
CREATE TABLE "practical_assessments" (
  "id"             TEXT NOT NULL,
  "ptId"           TEXT NOT NULL,
  "assessorId"     TEXT NOT NULL,
  "levelName"      TEXT,
  "exercisesCount" INTEGER NOT NULL DEFAULT 6,
  "scores"         TEXT NOT NULL,
  "exercises"      TEXT NOT NULL,
  "totalScore"     INTEGER NOT NULL,
  "maxScore"       INTEGER NOT NULL,
  "passed"         BOOLEAN NOT NULL,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "practical_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "practical_assessments_ptId_idx" ON "practical_assessments"("ptId");

ALTER TABLE "practical_assessments"
  ADD CONSTRAINT "practical_assessments_ptId_fkey"
  FOREIGN KEY ("ptId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "practical_assessments"
  ADD CONSTRAINT "practical_assessments_assessorId_fkey"
  FOREIGN KEY ("assessorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4) Điền sẵn ngưỡng thăng hạng theo tên cấp độ đang dùng.
UPDATE "pt_levels" SET "promoteMinAvgRevenue" = 15,   "promoteMinTransform" = 0 WHERE "name" = 'Thử việc';
UPDATE "pt_levels" SET "promoteMinAvgRevenue" = 30.4, "promoteMinTransform" = 1 WHERE "name" IN ('Cấp 1', 'Cấp 2', 'Cấp 3');
