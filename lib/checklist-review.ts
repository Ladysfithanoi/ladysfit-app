/**
 * Chốt ngày làm việc và đánh giá của FM.
 *
 * Vòng đời một ngày làm việc:
 *   1. Nhân sự mở Check-list ngày, điền việc. Bảng TỰ LƯU sau mỗi lần gõ —
 *      không còn nút "Lưu check-list" nào cả.
 *   2. Hết ngày, nhân sự viết tự luận cuối ngày rồi bấm CHECK-OUT. Đó là lúc
 *      `checkedOutAt` được đóng dấu và FM phụ trách cơ sở nhận thông báo.
 *   3. FM mở check-list của người đó, đọc tự luận và chấm ĐÁNH GIÁ CỦA FM
 *      (`fmRating` 1–5 + `fmComment`).
 *   4. Màn "Tổng kết đánh giá" cộng các điểm đó lại theo ngày / tuần / tháng /
 *      quý / năm.
 *
 * Mọi mốc ngày ở đây là chuỗi "YYYY-MM-DD" hoặc nửa đêm UTC, vì `reportDate`
 * của check-list là mốc ngày chứ không phải thời điểm — dùng giờ địa phương sẽ
 * lệch một ngày khi máy chủ chạy ở múi giờ khác.
 */

import { mondayOf, addDaysISO, parseYMD, ymd, isoWeekNumber } from "@/lib/week";

/** Thang điểm đánh giá của FM. */
export const MIN_RATING = 1;
export const MAX_RATING = 5;

/** Nhãn của từng mức điểm — dùng chung cho ô chấm và mọi bảng tổng kết. */
export const RATING_LABEL: Record<number, string> = {
  1: "Cần cải thiện nhiều",
  2: "Chưa đạt",
  3: "Đạt yêu cầu",
  4: "Tốt",
  5: "Xuất sắc",
};

/** `true` nếu điểm nằm trong thang cho phép. */
export function isValidRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value)
    && value >= MIN_RATING && value <= MAX_RATING;
}

/** Nửa đêm UTC của một mốc ngày "YYYY-MM-DD". */
export function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Khoảng `[from, to)` của một ngày, dùng thẳng cho filter `reportDate`. */
export function dayRange(dateStr: string) {
  const from = toDateOnly(dateStr);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);
  return { gte: from, lt: to };
}

/**
 * Một việc coi như xong khi KPI là số dương và kết quả đạt từ 80% trở lên —
 * cùng đúng một quy tắc với thanh tiến độ của check-list ngày, đừng chép lại
 * ở nơi khác.
 */
export function isTaskDone(kpi: string | null, actual: number | null): boolean {
  const k = kpi ? parseFloat(kpi) : NaN;
  if (isNaN(k) || k <= 0) return false;
  return ((actual ?? 0) / k) * 100 >= 80;
}

/**
 * Tự luận cuối ngày. Giờ chỉ còn MỘT ô `dailyResults`, nhưng check-list lưu từ
 * trước lúc gộp vẫn nằm rải ở ba ô cũ nên phải ghép lại thì mới đọc được.
 */
export function mergeReflection(c: {
  dailyResults:    string | null;
  dailyCompleted:  string | null;
  dailyIncomplete: string | null;
  dailyNextPlan:   string | null;
}): string {
  if (c.dailyResults && c.dailyResults.trim()) return c.dailyResults.trim();
  const parts: string[] = [];
  if (c.dailyCompleted?.trim())  parts.push(`✅ Đã hoàn thành:\n${c.dailyCompleted.trim()}`);
  if (c.dailyIncomplete?.trim()) parts.push(`⏳ Chưa hoàn thành:\n${c.dailyIncomplete.trim()}`);
  if (c.dailyNextPlan?.trim())   parts.push(`➡️ Giải pháp / kế hoạch:\n${c.dailyNextPlan.trim()}`);
  return parts.join("\n\n");
}

// ── Kỳ tổng kết ─────────────────────────────────────────────────────────────

export const PERIODS = ["day", "week", "month", "quarter", "year"] as const;
export type Period = typeof PERIODS[number];

export const PERIOD_LABEL: Record<Period, string> = {
  day:     "Ngày",
  week:    "Tuần",
  month:   "Tháng",
  quarter: "Quý",
  year:    "Năm",
};

export function isPeriod(value: unknown): value is Period {
  return typeof value === "string" && (PERIODS as readonly string[]).includes(value);
}

/**
 * Khoảng ngày của kỳ chứa `anchor`, trả về hai đầu ĐỀU BAO GỒM dưới dạng
 * "YYYY-MM-DD" cùng một nhãn đọc được. Tuần bắt đầu Thứ 2 như mọi chỗ khác
 * trong app (lib/week.ts).
 */
export function periodRange(period: Period, anchor: string): {
  from:  string;
  to:    string;
  label: string;
} {
  const d = parseYMD(anchor);
  const year = d.getFullYear();
  const month = d.getMonth();       // 0-based

  switch (period) {
    case "day":
      return { from: anchor, to: anchor, label: `Ngày ${fmtVN(anchor)}` };

    case "week": {
      const from = mondayOf(anchor);
      const to   = addDaysISO(from, 6);
      return { from, to, label: `Tuần ${isoWeekNumber(from)} · ${fmtVN(from)} – ${fmtVN(to)}` };
    }

    case "month": {
      const from = ymd(new Date(year, month, 1));
      const to   = ymd(new Date(year, month + 1, 0));
      return { from, to, label: `Tháng ${month + 1}/${year}` };
    }

    case "quarter": {
      const q = Math.floor(month / 3);                 // 0–3
      const from = ymd(new Date(year, q * 3, 1));
      const to   = ymd(new Date(year, q * 3 + 3, 0));
      return { from, to, label: `Quý ${q + 1}/${year}` };
    }

    case "year": {
      const from = ymd(new Date(year, 0, 1));
      const to   = ymd(new Date(year, 11, 31));
      return { from, to, label: `Năm ${year}` };
    }
  }
}

/** Lùi (`step` âm) hoặc tiến một kỳ, trả về mốc neo của kỳ liền kề. */
export function shiftPeriod(period: Period, anchor: string, step: number): string {
  const d = parseYMD(anchor);
  switch (period) {
    case "day":     return addDaysISO(anchor, step);
    case "week":    return addDaysISO(anchor, step * 7);
    case "month":   return ymd(new Date(d.getFullYear(), d.getMonth() + step, 1));
    case "quarter": return ymd(new Date(d.getFullYear(), d.getMonth() + step * 3, 1));
    case "year":    return ymd(new Date(d.getFullYear() + step, 0, 1));
  }
}

/** "21/09/2026" */
export function fmtVN(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
