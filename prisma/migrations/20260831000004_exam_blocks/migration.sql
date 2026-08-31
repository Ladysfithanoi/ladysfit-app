-- Khoá quyền vào thi của từng người, cho đúng một kỳ thi.
-- Có dòng ở đây = người đó không mở được đề. Admin bật/tắt trong tab Lịch thi.
CREATE TABLE "exam_blocks" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "examKey"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_blocks_userId_examKey_key" ON "exam_blocks"("userId", "examKey");
CREATE INDEX "exam_blocks_examKey_idx" ON "exam_blocks"("examKey");

ALTER TABLE "exam_blocks"
    ADD CONSTRAINT "exam_blocks_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
