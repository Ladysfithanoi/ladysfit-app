-- Gắn CẤP ĐỘ vào hệ thống thi.
--
-- Trước đây chỉ có MỘT ngân hàng đề phẳng dùng chung cho mọi cấp, và điều kiện
-- lý thuyết khi xét thăng cấp chỉ nhìn "lượt thi gần nhất" bất kể đó là đề gì.
-- Hệ quả: người đang ở Cấp 2 vẫn mang lượt thi Cấp 1 đã đậu từ đợt thăng cấp
-- trước, nên khi đủ doanh số + transform + thực hành là lên thẳng Cấp 3 mà
-- chưa từng làm một bài Cấp 3 nào.
--
-- Sau migration này: mỗi cấp có đề riêng, mỗi lượt thi ghi rõ là đề của cấp nào.

-- ── Đề của từng cấp ──────────────────────────────────────────────────────────
-- Nhiều-nhiều: một câu dùng chung cho vài cấp mà không phải chép lại.
CREATE TABLE "exam_question_levels" (
    "id"         TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "levelId"    TEXT NOT NULL,

    CONSTRAINT "exam_question_levels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_question_levels_questionId_levelId_key"
    ON "exam_question_levels"("questionId", "levelId");
CREATE INDEX "exam_question_levels_levelId_idx" ON "exam_question_levels"("levelId");

ALTER TABLE "exam_question_levels"
    ADD CONSTRAINT "exam_question_levels_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "exam_questions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exam_question_levels"
    ADD CONSTRAINT "exam_question_levels_levelId_fkey"
    FOREIGN KEY ("levelId") REFERENCES "pt_levels"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Số câu / điểm đạt riêng theo cấp (NULL = dùng số chung ở exam_config) ────
ALTER TABLE "pt_levels" ADD COLUMN "examNumQuestions" INTEGER;
ALTER TABLE "pt_levels" ADD COLUMN "examPassingScore" INTEGER;

-- ── Lượt thi ghi rõ là đề của cấp nào ───────────────────────────────────────
ALTER TABLE "exam_attempts"  ADD COLUMN "levelId" TEXT;
ALTER TABLE "exam_sessions"  ADD COLUMN "levelId" TEXT;

CREATE INDEX "exam_attempts_userId_levelId_idx" ON "exam_attempts"("userId", "levelId");

ALTER TABLE "exam_attempts"
    ADD CONSTRAINT "exam_attempts_levelId_fkey"
    FOREIGN KEY ("levelId") REFERENCES "pt_levels"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "exam_sessions"
    ADD CONSTRAINT "exam_sessions_levelId_fkey"
    FOREIGN KEY ("levelId") REFERENCES "pt_levels"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Đề dành cho FM bắt buộc thi ─────────────────────────────────────────────
-- FM không có cấp độ PT nên không suy ra được đề của họ; Admin chọn tay.
ALTER TABLE "exam_config" ADD COLUMN "fmLevelId" TEXT;

ALTER TABLE "exam_config"
    ADD CONSTRAINT "exam_config_fmLevelId_fkey"
    FOREIGN KEY ("fmLevelId") REFERENCES "pt_levels"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- Chuyển dữ liệu cũ
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Ngân hàng đề phẳng đang có phục vụ HAI cấp thấp nhất — đúng hiện trạng:
--    người Thử việc và người Cấp 1 lâu nay vẫn làm chung bộ câu hỏi này.
--    Các cấp trên để trống, chờ soạn đề riêng.
INSERT INTO "exam_question_levels" ("id", "questionId", "levelId")
SELECT
    'eql_' || substr(md5(q."id" || ':' || l."id"), 1, 24),
    q."id",
    l."id"
FROM "exam_questions" q
CROSS JOIN (
    SELECT "id" FROM "pt_levels" WHERE "isActive" = true ORDER BY "order" ASC LIMIT 2
) l
ON CONFLICT ("questionId", "levelId") DO NOTHING;

-- 2. FM làm đề của cấp cao nhất trong hai cấp trên (tức "Cấp 1").
--    Admin đổi được bất cứ lúc nào ở tab Lịch thi.
UPDATE "exam_config"
SET "fmLevelId" = (
    SELECT "id" FROM "pt_levels" WHERE "isActive" = true ORDER BY "order" ASC LIMIT 1 OFFSET 1
)
WHERE "fmLevelId" IS NULL;

-- 3. Bài thi cũ: gán về cấp của chính người thi NẾU cấp đó nằm trong hai cấp
--    mà ngân hàng đề cũ phục vụ — họ đã làm đúng bộ đề của cấp mình, giữ
--    nguyên kết quả là công bằng. Ai đang ở cấp cao hơn (Cấp 2 trở lên) thì bài
--    cũ của họ chỉ có thể là đề Cấp 1, nên gán về Cấp 1 — và đó chính là chỗ
--    bịt lỗ hổng: từ nay họ phải làm đề Cấp 2 mới lên được Cấp 3.
UPDATE "exam_attempts" a
SET "levelId" = COALESCE(
    (
        SELECT u."ptLevelId"
        FROM "users" u
        WHERE u."id" = a."userId"
          AND u."ptLevelId" IN (
              SELECT "id" FROM "pt_levels" WHERE "isActive" = true ORDER BY "order" ASC LIMIT 2
          )
    ),
    (SELECT "id" FROM "pt_levels" WHERE "isActive" = true ORDER BY "order" ASC LIMIT 1 OFFSET 1)
)
WHERE a."levelId" IS NULL;
