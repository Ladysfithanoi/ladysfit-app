import { prisma } from "@/lib/prisma";

/**
 * THỐNG KÊ LƯƠNG THEO QUÝ / NĂM — chỉ tính phần ĐÃ THANH TOÁN.
 *
 * Quý / năm không có bảng chi tiết từng khoản: mỗi người một dòng, mỗi tháng một
 * cột là tổng lương của dòng lương tháng đó đã chuyển "Đã thanh toán" (PAID).
 * Dòng PAID là số đã chốt (isSalaryLocked) nên đọc thẳng, không tính lại.
 * Màn hình và file Excel cùng đọc qua đây.
 */

export type SalaryPeriodKind = "quarter" | "year";

/** Các tháng của kỳ: quý q → 3 tháng, năm → 12 tháng. */
export function periodMonths(kind: SalaryPeriodKind, quarter?: number | null): number[] {
  if (kind === "year") return Array.from({ length: 12 }, (_, i) => i + 1);
  const q = Math.min(4, Math.max(1, quarter ?? 1));
  return [q * 3 - 2, q * 3 - 1, q * 3];
}

export type SalaryPeriodRow = {
  userId:     string;
  name:       string;
  role:       string;
  /** Nhãn hiện cạnh tên: chức vụ nếu có, không thì vai trò. */
  position:   string;
  branchId:   string;
  branchName: string;
  /** Tháng → tổng lương đã thanh toán của tháng đó. */
  byMonth:    Record<number, number>;
  total:      number;
};

export type SalaryPeriodSummary = {
  months:      number[];
  rows:        SalaryPeriodRow[];
  monthTotals: Record<number, number>;
  grandTotal:  number;
};

const ROLE_ORDER: Record<string, number> = { FM: 0, PT: 1, ADMIN: 2, STAFF: 3 };
const ROLE_LABEL: Record<string, string> = { FM: "FM", PT: "PT", ADMIN: "Admin", STAFF: "Nhân sự" };

export async function loadPaidSalaryPeriod(
  branchIds: string[],
  year:      number,
  months:    number[],
): Promise<SalaryPeriodSummary> {
  const records = await prisma.salaryRecord.findMany({
    where: { branchId: { in: branchIds }, year, month: { in: months }, status: "PAID" },
    select: {
      userId: true, branchId: true, month: true, totalSalary: true,
      user:   { select: { name: true, email: true, role: true, jobPosition: { select: { name: true } } } },
      branch: { select: { name: true } },
    },
  });

  // Mỗi người một dòng ở mỗi cơ sở — Admin / nhân sự làm nhiều cơ sở có bảng
  // lương riêng từng cơ sở (lib/work-branches).
  const byKey = new Map<string, SalaryPeriodRow>();
  const monthTotals: Record<number, number> = Object.fromEntries(months.map(m => [m, 0]));
  let grandTotal = 0;
  for (const r of records) {
    const key = `${r.userId}:${r.branchId}`;
    let row = byKey.get(key);
    if (!row) {
      row = {
        userId:     r.userId,
        name:       r.user.name ?? r.user.email,
        role:       r.user.role,
        position:   r.user.jobPosition?.name ?? ROLE_LABEL[r.user.role] ?? r.user.role,
        branchId:   r.branchId,
        branchName: r.branch.name,
        byMonth:    {},
        total:      0,
      };
      byKey.set(key, row);
    }
    row.byMonth[r.month] = (row.byMonth[r.month] ?? 0) + r.totalSalary;
    row.total           += r.totalSalary;
    monthTotals[r.month] += r.totalSalary;
    grandTotal          += r.totalSalary;
  }

  const rows = Array.from(byKey.values()).sort((a, b) =>
    a.branchName.localeCompare(b.branchName, "vi") ||
    (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
    a.name.localeCompare(b.name, "vi"));

  return { months, rows, monthTotals, grandTotal };
}
