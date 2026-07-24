/**
 * Đánh giá buổi tập (Autoregulation — Eric Helms)
 * ────────────────────────────────────────────────
 * Sau khi khách đủ điều kiện kết thúc buổi, PT làm 1 bảng đánh giá nhanh gồm 3
 * trục (hiệu suất, cảm giác nỗ lực/RIR, hồi phục cơ-khớp). Từ 3 trục này suy ra
 * gợi ý điều chỉnh tải cho BUỔI TẬP SAU (cùng loại buổi ở tuần kế tiếp).
 *
 * Tham khảo logic từ app training-plan (Helms — "RPE-based Periodization" &
 * "The Muscle & Strength Pyramids"). 27 nhánh (3×3×3) gom về các quyết định
 * tăng/giữ/giảm tải + kiểm tra kỹ thuật + ưu tiên hồi phục.
 *
 * Đây là các hàm thuần (pure) — không I/O — dùng được ở cả server (route
 * check-out) lẫn client (LiveSessionPanel).
 */

/** Khách vượt / đạt / trượt mục tiêu số rep. */
export type SurveyPerformance = "exceed" | "meet" | "miss";
/** Cảm giác nỗ lực thực tế so với RIR mục tiêu. */
export type SurveyRirFeel = "easier" | "on_target" | "too_hard";
/** Tình trạng hồi phục cơ & khớp khi bước vào buổi tập. */
export type SurveyRecovery = "great" | "normal" | "sore";

export interface SessionSurvey {
  performance: SurveyPerformance;
  rirFeel: SurveyRirFeel;
  recovery: SurveyRecovery;
}

// ─── Cây quyết định (27 nhánh) — key: `${performance}_${rirFeel}_${recovery}` ──
const SUGGESTION_TREE: Record<string, string> = {
  // ── Vượt mục tiêu ──────────────────────────────────────────────────────────
  exceed_easier_great:
    "🏆 Cơ thể phản hồi xuất sắc — dấu hiệu siêu phục hồi (supercompensation). Tăng tạ buổi sau: +2.5–5 kg bài phức hợp, +1–2.5 kg bài phụ (dumbbell/cable). Duy trì số hiệp.",
  exceed_easier_normal:
    "✅ Hiệu suất tốt vượt kỳ vọng. Tăng tạ nhẹ (+2.5 kg) buổi sau. Duy trì số hiệp và dải rep. Theo dõi cảm giác khớp trong tuần.",
  exceed_easier_sore:
    "⚠️ Vượt mục tiêu nhưng khớp có dấu hiệu mệt mỏi. Giữ nguyên tạ, giảm tổng volume 10–15% buổi sau. Ưu tiên phục hồi — kéo giãn, ngủ đủ giấc, dinh dưỡng — trước khi tăng tải.",
  exceed_on_target_great:
    "✅ Hiệu suất và nỗ lực cân bằng hoàn hảo. Áp dụng lũy tiến kép: thêm 1–2 rep mỗi hiệp buổi sau, sau đó tăng tạ khi đạt ngưỡng trên của dải rep.",
  exceed_on_target_normal:
    "✅ Đúng hướng. Duy trì tạ hiện tại, tăng thêm 1 rep mỗi hiệp để lấp đầy dải rep mục tiêu trước khi tăng tạ. Không vội tăng tải.",
  exceed_on_target_sore:
    "⚠️ Giữ nguyên tạ và volume buổi sau. Tập trung phục hồi: kéo giãn chủ động, ngủ chất lượng, đủ protein. Đánh giá lại tình trạng khớp đầu tuần trước khi quyết định.",
  exceed_too_hard_great:
    "🔍 Vượt rep nhưng RPE thực tế cao hơn kế hoạch — có thể đang underestimate RIR. Giữ nguyên tạ. Buổi sau: hiệu chỉnh lại cách xác định RIR, tập trung vào cảm giác thực tế từng hiệp.",
  exceed_too_hard_normal:
    "🔍 Vượt rep nhưng cảm thấy quá sức. Giữ tạ, kiểm tra lại kỹ thuật thực hiện và biên độ chuyển động (ROM). Đảm bảo ROM đầy đủ trước khi tăng tải.",
  exceed_too_hard_sore:
    "⛔ Dừng tăng tải. Giảm tạ 5–10%, giảm 1 hiệp mỗi bài. Cơ thể đang tích lũy mệt mỏi (accumulated fatigue) — ưu tiên phục hồi toàn diện tuần này.",

  // ── Đạt mục tiêu ───────────────────────────────────────────────────────────
  meet_easier_great:
    "✅ Cơ thể thích nghi và sẵn sàng cho kích thích mới. Tăng tạ nhẹ (+2.5 kg) buổi sau — cơ thể đang phát tín hiệu muốn tăng tải.",
  meet_easier_normal:
    "✅ Cảm giác tốt, đúng kế hoạch. Tăng nhẹ (+2.5 kg) hoặc thêm 1 hiệp phụ buổi sau — chọn một trong hai, không cả hai cùng lúc.",
  meet_easier_sore:
    "⚠️ Dù nhẹ nhàng nhưng khớp có dấu hiệu mệt. Giữ nguyên tạ, giảm volume nhẹ (−1 hiệp ở bài gây đau). Ngủ đủ giấc và bổ sung dinh dưỡng phục hồi tuần này.",
  meet_on_target_great:
    "✅ Hoàn hảo theo kế hoạch. Duy trì tạ và volume. Nếu cảm giác tương tự buổi sau, đây là thời điểm tăng +2.5 kg theo nguyên tắc lũy tiến.",
  meet_on_target_normal:
    "✅ Đúng kế hoạch, không cần thay đổi. Tính nhất quán là chìa khóa — tiếp tục chương trình hiện tại và theo dõi xu hướng dài hạn.",
  meet_on_target_sore:
    "⚠️ Giảm 1–2 hiệp ở các bài gây đau nhức buổi sau. Duy trì cường độ (giữ nguyên tạ) nhưng giảm tổng volume 15–20%.",
  meet_too_hard_great:
    "↓ RIR thực tế thấp hơn mục tiêu dù cơ thể ổn. Giảm tạ 5% buổi sau để khôi phục vùng rep tối ưu và kiểm soát RIR chính xác hơn trong từng hiệp.",
  meet_too_hard_normal:
    "↓ Giảm tạ 5–7.5% buổi sau. Tập trung thực hiện đúng RIR mục tiêu xuyên suốt tất cả các hiệp — chất lượng quan trọng hơn số lượng.",
  meet_too_hard_sore:
    "⛔ Giảm tạ 10% và bớt 1 hiệp mỗi bài buổi sau. Cơ thể đang tích lũy mệt mỏi — phải giải phóng fatigue trước khi tiếp tục tăng tải, nếu không nguy cơ chấn thương sẽ tăng cao.",

  // ── Trượt mục tiêu ─────────────────────────────────────────────────────────
  miss_easier_great:
    "🔍 Không đạt rep nhưng cảm thấy nhẹ nhàng — kiểm tra kỹ thuật và biên độ chuyển động (ROM). Giữ tạ, thêm 1 hiệp phụ với tạ giảm 20% cuối buổi để tích lũy volume.",
  miss_easier_normal:
    "🔍 Không đạt rep dù không mệt. Kiểm tra các yếu tố ngoài tập (giấc ngủ, dinh dưỡng, stress). Giữ nguyên tạ, tập trung kỹ thuật và kiểm soát tempo buổi sau.",
  miss_easier_sore:
    "⚠️ Giữ nguyên tạ, giảm 1 hiệp. Cơ thể chưa phục hồi đủ — ưu tiên nghỉ ngơi chất lượng và dinh dưỡng tuần này trước khi tăng bất kỳ thứ gì.",
  miss_on_target_great:
    "↔ Đúng RIR nhưng chưa đủ rep — có thể thiếu volume tích lũy. Giữ tạ, thêm 1 hiệp nhẹ (70% tạ làm việc) vào cuối buổi để xây dựng base volume.",
  miss_on_target_normal:
    "↔ Duy trì tạ và số hiệp. Không thay đổi — thực hiện nhất quán và đúng kỹ thuật trong từng hiệp là ưu tiên buổi sau.",
  miss_on_target_sore:
    "⛔ Không đạt và cơ thể mệt mỏi. Buổi sau: giảm 1 hiệp mỗi bài, giữ nguyên tạ. Phục hồi là ưu tiên tuyệt đối — không thêm bất kỳ kích thích mới nào.",
  miss_too_hard_great:
    "↓ Tạ quá cao so với khả năng hiện tại dù cơ thể cảm thấy ổn. Giảm 7.5–10% buổi sau và kiểm tra lại toàn bộ thông số kỹ thuật: tempo, ROM, điểm hỗ trợ.",
  miss_too_hard_normal:
    "↓ Deload nhẹ: giảm tạ 10%, giảm 1–2 hiệp. Xây dựng lại nền tảng kỹ thuật và kiểm soát RIR trong suốt buổi sau trước khi nghĩ đến tăng tải.",
  miss_too_hard_sore:
    "⛔ DELOAD NGAY. Giảm tạ 15–20%, giảm tổng volume 30%. Cơ thể đang ở ngưỡng quá tải — tiếp tục với cường độ hiện tại sẽ dẫn đến chấn thương. Nghỉ ngơi tích cực (active rest) tuần này.",
};

/**
 * Từ bảng đánh giá 3 trục → gợi ý điều chỉnh tải cho buổi tập sau (tiếng Việt).
 */
export function buildNextSessionSuggestion(survey: SessionSurvey): string {
  const key = `${survey.performance}_${survey.rirFeel}_${survey.recovery}`;
  return (
    SUGGESTION_TREE[key] ??
    "Duy trì chương trình hiện tại. Theo dõi phản hồi cơ thể và đánh giá lại buổi tập tới."
  );
}

const PERFORMANCE_VALUES: SurveyPerformance[] = ["exceed", "meet", "miss"];
const RIR_VALUES: SurveyRirFeel[] = ["easier", "on_target", "too_hard"];
const RECOVERY_VALUES: SurveyRecovery[] = ["great", "normal", "sore"];

/** Kiểm tra một object bất kỳ có phải bảng đánh giá hợp lệ (đủ 3 trục đúng giá trị). */
export function isValidSurvey(input: unknown): input is SessionSurvey {
  if (!input || typeof input !== "object") return false;
  const s = input as Record<string, unknown>;
  return (
    PERFORMANCE_VALUES.includes(s.performance as SurveyPerformance) &&
    RIR_VALUES.includes(s.rirFeel as SurveyRirFeel) &&
    RECOVERY_VALUES.includes(s.recovery as SurveyRecovery)
  );
}
