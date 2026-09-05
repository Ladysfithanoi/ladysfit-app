-- Hồ sơ của vòng DỰNG GIÁO ÁN — case study về chuyên môn.
--
-- Song song với exam_meal_briefs và cố ý giống hệt về cấu trúc: có chỉ tiêu, có
-- sai số, có thứ tuyệt đối cấm. Khác ở chỗ khối lượng một buổi tập không phải
-- một con số mà là bốn — tổng set và phần chia cho thân dưới / thân trên / core.
-- Đúng tổng mà dồn hết vào chân thì vẫn là một buổi tập hỏng.
CREATE TABLE "exam_program_cases" (
  "id"               TEXT NOT NULL,
  "roundId"          TEXT NOT NULL,
  "order"            INTEGER NOT NULL DEFAULT 0,
  -- Mô tả khách: tuổi, cân nặng, mục tiêu, chấn thương, số buổi/tuần…
  "clientProfile"    TEXT NOT NULL,
  -- Chỉ tiêu số set. Để trống thì vòng không chấm mục đó.
  "targetTotalSets"  INTEGER,
  "targetLowerSets"  INTEGER,
  "targetUpperSets"  INTEGER,
  "targetCoreSets"   INTEGER,
  -- Sai số cho phép quanh mỗi chỉ tiêu (%). Set là số nguyên nhỏ nên khi chấm
  -- luôn nới thêm ít nhất 1 set, không thì khoảng cho phép thành rỗng.
  "tolerancePercent" INTEGER NOT NULL DEFAULT 15,
  -- Mẫu vận động bắt buộc phải có mặt (JSON mảng): "Squat", "Hinge", "Pull"…
  -- Thiếu một mẫu là mất phần điểm tương ứng, dù số set có đẹp tới đâu.
  "requiredPatterns" TEXT,
  -- Bài CHỐNG CHỈ ĐỊNH với khách này (JSON mảng). Dùng một bài là hỏng cả hồ sơ,
  -- không có điểm an ủi — đúng như dị ứng ở vòng khay ăn.
  "bannedExercises"  TEXT,
  "explanation"      TEXT,

  CONSTRAINT "exam_program_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exam_program_cases_roundId_order_idx" ON "exam_program_cases"("roundId", "order");

ALTER TABLE "exam_program_cases"
  ADD CONSTRAINT "exam_program_cases_roundId_fkey"
  FOREIGN KEY ("roundId") REFERENCES "exam_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
