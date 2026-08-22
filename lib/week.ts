// ── Tuần làm việc (Thứ 2 → Chủ Nhật) ─────────────────────────────────────────
// Mọi hàm ở đây làm việc trên chuỗi "YYYY-MM-DD" nên không phụ thuộc múi giờ:
// Date chỉ được dựng từ (năm, tháng, ngày) và cũng chỉ đọc lại 3 thành phần đó.

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseYMD(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysISO(iso: string, n: number): string {
  const d = parseYMD(iso);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Ngày hôm nay theo giờ Việt Nam (UTC+7) — dùng được cả trên server chạy UTC. */
export function todayVN(): string {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Thứ trong tuần theo giờ VN: 0 = Chủ Nhật … 6 = Thứ 7. */
export function dayOfWeekVN(): number {
  return parseYMD(todayVN()).getDay();
}

/** Thứ 2 của tuần chứa `iso`. */
export function mondayOf(iso: string): string {
  const d = parseYMD(iso);
  const dow = d.getDay(); // 0 = CN
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return ymd(d);
}

/** 7 ngày của tuần bắt đầu từ `mondayISO`. */
export function weekDays(mondayISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(mondayISO, i));
}

/** Số tuần theo chuẩn ISO-8601 (tuần chứa Thứ 5 đầu tiên của năm là tuần 1). */
export function isoWeekNumber(iso: string): number {
  const target = parseYMD(iso);
  const dayNr = (target.getDay() + 6) % 7;      // 0 = Thứ 2
  target.setDate(target.getDate() - dayNr + 3); // Thứ 5 của tuần này
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const fDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - fDayNr + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

/**
 * Khoá lưu trữ của một tuần trong bảng weekly_monthly_reports.
 * Tháng/năm lấy theo Thứ 5 của tuần (chuẩn ISO) nên tuần vắt qua 2 tháng
 * luôn được quy về đúng một tháng duy nhất.
 */
export function weekKey(mondayISO: string): { year: number; month: number; weekNumber: number } {
  const thursday = parseYMD(addDaysISO(mondayISO, 3));
  return {
    year: thursday.getFullYear(),
    month: thursday.getMonth() + 1,
    weekNumber: isoWeekNumber(mondayISO),
  };
}

export function fmtDayMonth(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** "Tuần 34 · 18/08 – 24/08/2026" */
export function weekLabel(mondayISO: string): string {
  const sunday = addDaysISO(mondayISO, 6);
  const [y] = sunday.split("-");
  return `Tuần ${isoWeekNumber(mondayISO)} · ${fmtDayMonth(mondayISO)} – ${fmtDayMonth(sunday)}/${y}`;
}

export const VN_DAY_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];
