/**
 * Ngày công của một tháng.
 *
 * Ngày công CHUẨN của tháng = tổng số ngày trong tháng trừ đi số ngày Chủ nhật
 * của tháng đó → thường 24–27 ngày.
 *
 * Ngày công THỰC TẾ do FM nhập tay trong bảng lương. Lương cứng (lương cơ bản +
 * phụ cấp cố định) tính theo LƯƠNG MỘT NGÀY = lương cứng / 26 (xem
 * PAID_DAYS_BASE): nghỉ ngày nào trừ ngày đó, tháng có hơn 26 ngày công chuẩn
 * thì được cộng thêm lương một ngày cho mỗi ngày dư. Hoa hồng, tiền buổi dạy và
 * các khoản thưởng KHÔNG bị chia.
 */

/** Ngày công chuẩn = số ngày trong tháng − số Chủ nhật. `month` 1-based. */
export function standardWorkDays(month: number, year: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let sundays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    if (new Date(year, month - 1, day).getDay() === 0) sundays++;
  }
  return daysInMonth - sundays;
}

/** Lương cứng là lương của 26 ngày công: lương một ngày = lương cứng / 26. */
export const PAID_DAYS_BASE = 26;

/**
 * Hệ số nhân với lương cứng theo ngày công.
 *
 * Mỗi ngày nghỉ (ngày công chuẩn − thực tế) trừ một ngày lương; tháng có hơn
 * 26 ngày công chuẩn thì mỗi ngày dư cộng thêm một ngày lương. Đi làm đủ:
 *   • tháng 27 ngày → 27/26 (thêm 1 ngày lương)
 *   • tháng 26 ngày → đủ lương
 *   • tháng 24–25 ngày → vẫn đủ lương (không bị trừ vì tháng ít ngày)
 * Nhập vượt ngày công chuẩn cũng không được tính thêm.
 */
export function workDayRatio(actualWorkDays: number, standard: number): number {
  if (standard <= 0) return 1;
  return paidWorkDays(actualWorkDays, standard) / PAID_DAYS_BASE;
}

/**
 * Số công ĐƯỢC TÍNH LƯƠNG trên thang 26 — con số hiển thị kiểu "27/26": tháng
 * 27 ngày công đi làm đủ là 27/26, nghỉ 1 ngày là 26/26; tháng 24 ngày đi làm
 * đủ vẫn 26/26. Cùng một phép tính với workDayRatio nên số hiện ra và tiền lương
 * không thể lệch nhau.
 */
export function paidWorkDays(actualWorkDays: number, standard: number): number {
  if (standard <= 0) return PAID_DAYS_BASE;
  if (actualWorkDays <= 0) return 0;
  const missed = standard - Math.min(actualWorkDays, standard);
  return Math.max(0, Math.max(standard, PAID_DAYS_BASE) - missed);
}

/**
 * Ngày công để hiển thị: nghỉ nửa ngày làm số ngày lẻ .5 nên viết kiểu Việt Nam
 * ("25,5"), số nguyên thì không kèm phần thập phân ("25").
 */
export function formatDays(days: number): string {
  return Number.isInteger(days) ? String(days) : days.toFixed(1).replace(".", ",");
}
