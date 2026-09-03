-- Đề thử thách nhiều vòng (7 đại tội) cho cửa Cấp 2 lên Cấp 3.
--
-- Đề của cấp thấp vẫn là trắc nghiệm phẳng như cũ, không đụng tới. Cấp nào đặt
-- examFormat = 'TRIAL' thì trang làm bài đổi hẳn sang dạng nhiều vòng chơi.
-- Điểm cuối cùng vẫn ghi vào exam_attempts như đề phẳng, nên bộ máy xét thăng
-- cấp không cần biết đề thuộc dạng nào.

CREATE TYPE "ExamFormat"    AS ENUM ('FLAT', 'TRIAL');
CREATE TYPE "ExamRoundType" AS ENUM ('MEAL', 'SORT');
CREATE TYPE "ExamSortZone"  AS ENUM ('ACCEPT', 'CAUTION', 'REFUSE');

ALTER TABLE "pt_levels"     ADD COLUMN "examFormat" "ExamFormat" NOT NULL DEFAULT 'FLAT';
ALTER TABLE "exam_sessions" ADD COLUMN "trialState" TEXT;

-- ── Vòng thi ────────────────────────────────────────────────────────────────
CREATE TABLE "exam_rounds" (
    "id"          TEXT NOT NULL,
    "levelId"     TEXT NOT NULL,
    "type"        "ExamRoundType" NOT NULL,
    "name"        TEXT NOT NULL,
    "intro"       TEXT,
    "order"       INTEGER NOT NULL DEFAULT 0,
    "maxPoints"   INTEGER NOT NULL DEFAULT 100,
    "passPercent" INTEGER NOT NULL DEFAULT 60,
    "failPenalty" INTEGER NOT NULL DEFAULT 20,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_rounds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exam_rounds_levelId_order_idx" ON "exam_rounds"("levelId", "order");

ALTER TABLE "exam_rounds"
    ADD CONSTRAINT "exam_rounds_levelId_fkey"
    FOREIGN KEY ("levelId") REFERENCES "pt_levels"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Vòng Phàm ăn: hồ sơ khách + chỉ tiêu dinh dưỡng ─────────────────────────
CREATE TABLE "exam_meal_briefs" (
    "id"               TEXT NOT NULL,
    "roundId"          TEXT NOT NULL,
    "order"            INTEGER NOT NULL DEFAULT 0,
    "clientProfile"    TEXT NOT NULL,
    "targetCalories"   INTEGER,
    "targetProtein"    INTEGER,
    "targetFat"        INTEGER,
    "targetCarbs"      INTEGER,
    "tolerancePercent" INTEGER NOT NULL DEFAULT 10,
    "bannedFoods"      TEXT,
    "explanation"      TEXT,

    CONSTRAINT "exam_meal_briefs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exam_meal_briefs_roundId_order_idx" ON "exam_meal_briefs"("roundId", "order");

ALTER TABLE "exam_meal_briefs"
    ADD CONSTRAINT "exam_meal_briefs_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "exam_rounds"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Vòng Sa ngã: thẻ tình huống + vùng ranh giới đúng ───────────────────────
CREATE TABLE "exam_sort_cards" (
    "id"          TEXT NOT NULL,
    "roundId"     TEXT NOT NULL,
    "order"       INTEGER NOT NULL DEFAULT 0,
    "text"        TEXT NOT NULL,
    "correctZone" "ExamSortZone" NOT NULL,
    "explanation" TEXT,

    CONSTRAINT "exam_sort_cards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exam_sort_cards_roundId_order_idx" ON "exam_sort_cards"("roundId", "order");

ALTER TABLE "exam_sort_cards"
    ADD CONSTRAINT "exam_sort_cards_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "exam_rounds"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Kết quả từng vòng của một lượt thi ──────────────────────────────────────
CREATE TABLE "exam_round_results" (
    "id"        TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "roundId"   TEXT NOT NULL,
    "points"    INTEGER NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "passed"    BOOLEAN NOT NULL,
    "penalty"   INTEGER NOT NULL DEFAULT 0,
    "detail"    TEXT NOT NULL,
    "pillar"    TEXT,

    CONSTRAINT "exam_round_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_round_results_attemptId_roundId_key"
    ON "exam_round_results"("attemptId", "roundId");

ALTER TABLE "exam_round_results"
    ADD CONSTRAINT "exam_round_results_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "exam_attempts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exam_round_results"
    ADD CONSTRAINT "exam_round_results_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "exam_rounds"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
