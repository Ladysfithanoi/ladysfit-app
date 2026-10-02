// ── Lương thâm niên ─────────────────────────────────────────────────────────
//
// Mức thâm niên là số TIỀN CẢ NĂM cho mỗi năm thâm niên: FM 9.000.000đ/năm, PT
// 6.000.000đ/năm, tối đa 4 năm. Bảng lương THÁNG chỉ cộng 1/12 của số đó — FM 1
// năm thâm niên được 750.000đ/tháng chứ không phải 9 triệu mỗi tháng.

export const MAX_SENIORITY_YEARS = 4;

/** Tiền thâm niên CẢ NĂM cho mỗi năm thâm niên, theo vai trò. */
export const SENIORITY_PER_YEAR: Record<string, number> = {
  FM: 9_000_000,
  PT: 6_000_000,
};

const annualOf = (role: string) => SENIORITY_PER_YEAR[role] ?? 0;

/** Tiền thâm niên cộng vào lương MỘT THÁNG. */
export function monthlySeniorityBonus(role: string, years: number): number {
  const y = Math.max(0, Math.min(years, MAX_SENIORITY_YEARS));
  return Math.round((y * annualOf(role)) / 12);
}

/** Số năm thâm niên suy ngược từ tiền thâm niên tháng (để hiển thị). */
export function seniorityYearsOf(role: string, monthlyBonus: number): number {
  const annual = annualOf(role);
  return annual > 0 ? Math.round((monthlyBonus * 12) / annual) : 0;
}

/**
 * Số năm thâm niên TẠI THÁNG LƯƠNG, tính từ Ngày làm chính thức. Tính theo THÁNG:
 * tháng kỷ niệm là tháng bắt đầu được cộng — làm chính thức 02/10/2025 thì lương
 * tháng 10/2026 có 1 năm, lương tháng 9/2026 vẫn 0 năm. Không có ngày → null.
 *
 * Trước đây số năm chỉ tính MỘT LẦN lúc gõ ngày (theo hôm đó) rồi lưu cứng, nên
 * sai cả hai chiều: nhập ngày sau kỷ niệm thì cả tháng trước kỷ niệm cũng được
 * cộng; nhập trước kỷ niệm thì đủ năm rồi vẫn 0 mãi.
 */
export function seniorityYearsAt(
  officialStartDate: Date | null | undefined,
  month: number,
  year: number,
): number | null {
  if (!officialStartDate || isNaN(officialStartDate.getTime())) return null;
  // Mốc lưu dạng nửa đêm — đọc theo giờ Việt Nam cho chắc đúng ngày/tháng.
  const vn = new Date(officialStartDate.getTime() + 7 * 3600_000);
  const months = (year * 12 + month) - (vn.getUTCFullYear() * 12 + vn.getUTCMonth() + 1);
  return Math.max(0, Math.min(MAX_SENIORITY_YEARS, Math.floor(months / 12)));
}

/**
 * Số năm thâm niên dùng cho bảng lương một tháng: theo Ngày làm chính thức nếu
 * có, không có thì dùng số năm nhập tay trong Cấu hình lương.
 */
export function seniorityYearsFor(
  config: { officialStartDate: Date | null; seniorityYears: number } | null | undefined,
  month: number,
  year: number,
): number {
  if (!config) return 0;
  return seniorityYearsAt(config.officialStartDate, month, year) ?? config.seniorityYears;
}
