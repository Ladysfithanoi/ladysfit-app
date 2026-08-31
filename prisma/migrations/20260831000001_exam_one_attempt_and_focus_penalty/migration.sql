-- Mỗi người chỉ thi MỘT lần một kỳ + phạt rời khỏi trang thi.
--
-- exam_sessions giữ trạng thái của một LƯỢT thi (một người × một kỳ): đề đã
-- bốc, mốc bắt đầu, số phút bị trừ vì rời trang, và mốc nộp bài. Nộp xong là
-- khoá — mở lại đề bị chặn. Tải lại trang thì lấy đúng đề cũ, đúng giờ cũ.

-- Số phút bị trừ mỗi lần thí sinh rời khỏi trang thi (0 = chỉ ghi nhận, không trừ)
ALTER TABLE "exam_config" ADD COLUMN "focusPenaltyMinutes" INTEGER NOT NULL DEFAULT 30;

-- Số lần rời trang của bài đã nộp — chép từ exam_sessions để còn xem về sau
ALTER TABLE "exam_attempts" ADD COLUMN "violations" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "exam_sessions" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "examKey"         TEXT NOT NULL,
    "questionIds"     TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "startedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "penaltyMinutes"  INTEGER NOT NULL DEFAULT 0,
    "violations"      INTEGER NOT NULL DEFAULT 0,
    "lastViolationAt" TIMESTAMP(3),
    "submittedAt"     TIMESTAMP(3),
    "attemptId"       TEXT,

    CONSTRAINT "exam_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_sessions_userId_examKey_key" ON "exam_sessions"("userId", "examKey");
CREATE INDEX "exam_sessions_examKey_idx" ON "exam_sessions"("examKey");

ALTER TABLE "exam_sessions"
    ADD CONSTRAINT "exam_sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
