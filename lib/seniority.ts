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
 * Bảng lương tạo trước khi đổi luật lưu nguyên tiền CẢ NĂM vào một tháng (bội
 * số tròn của 9 triệu / 6 triệu). Tiền tháng theo luật mới (bội của 750k / 500k,
 * tối đa 4 năm) không bao giờ là bội của mức cả năm, nên nhận ra được và chia 12.
 */
export function normalizeSeniorityBonus(role: string, bonus: number): number {
  const annual = annualOf(role);
  if (annual <= 0 || bonus <= 0 || bonus % annual !== 0) return bonus;
  return monthlySeniorityBonus(role, bonus / annual);
}
