/**
 * Ngày công của một tháng.
 *
 * Ngày công CHUẨN (số ngày tối đa một nhân sự được nhận lương cứng) = tổng số
 * ngày trong tháng trừ đi số ngày Chủ nhật của tháng đó → thường 26–27 ngày.
 *
 * Ngày công THỰC TẾ do FM nhập tay trong bảng lương. Lương cứng (lương cơ bản +
 * phụ cấp cố định) được chia theo tỉ lệ ngày công thực tế / ngày công chuẩn.
 * Hoa hồng, tiền buổi dạy và các khoản thưởng KHÔNG bị chia.
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

/**
 * Hệ số chia lương cứng theo ngày công. Luôn nằm trong [0, 1] — đi làm nhiều hơn
 * ngày công chuẩn cũng không làm lương cứng vượt mức.
 */
export function workDayRatio(actualWorkDays: number, standard: number): number {
  if (standard <= 0) return 1;
  if (actualWorkDays <= 0) return 0;
  return Math.min(actualWorkDays, standard) / standard;
}
