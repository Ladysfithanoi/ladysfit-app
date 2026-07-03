/** All role values that represent a Personal Trainer (staff PT). */
export const PT_ROLES = ["PT"] as const;

/** Returns true if the role belongs to the PT staff group. */
export function isPTRole(role: string | null | undefined): boolean {
  return PT_ROLES.includes(role as (typeof PT_ROLES)[number]);
}

// ── KPI doanh số để tính hiệu suất (triệu/tháng) ────────────────────────────
// Công thức cố định: hiệu suất doanh số = doanh số thực / KPI. KPI lấy theo cấp độ PT
// (PTLevel.monthlyTarget) — cấp "Thử việc" 15tr, các cấp PT chính thức 38tr.
/** KPI doanh số/tháng mặc định khi nhân sự chưa gán cấp độ PT. */
export const DEFAULT_SALES_TARGET = 38;

/** KPI doanh số/tháng (triệu) của một nhân sự — lấy theo cấp độ PT, fallback mặc định. */
export function salesTargetFor(monthlyTarget: number | null | undefined): number {
  return monthlyTarget != null && monthlyTarget > 0 ? monthlyTarget : DEFAULT_SALES_TARGET;
}
