import { workDayRatio } from "@/lib/work-days";

/**
 * Công thức tổng lương dùng chung cho mọi nơi tạo/tính lại bảng lương
 * (tạo bảng lương, GET tính lại theo doanh số mới, PUT khi FM sửa ngày công).
 *
 * Lương cứng = (lương cơ bản + phụ cấp cố định) × (ngày công thực tế / ngày công
 * chuẩn). Hoa hồng, tiền buổi dạy, thâm niên và các khoản thưởng KHÔNG bị chia
 * theo ngày công. Admin dạy thêm không có lương cứng nên không áp dụng.
 *
 * Bản ghi cũ chưa có ngày công (standardWorkDays = 0) → workDayRatio trả 1, tổng
 * lương giữ nguyên như công thức trước đây.
 */
export type SalaryParts = {
  role:             string;
  baseSalary:       number;
  fixedAllowances:  number;
  seniorityBonus:   number;
  commissionAmount: number;
  showPay:          number;
  goalBonus:        number;
  googleBonus:      number;
  renewBonus:       number;
  kocCommission:    number;
  kolCommission:    number;
  standardWorkDays: number;
  actualWorkDays:   number;
};

export function computeTotalSalary(p: SalaryParts): number {
  if (p.role === "ADMIN") {
    return p.commissionAmount + p.showPay + p.kocCommission + p.kolCommission;
  }

  const fixedPay = (p.baseSalary + p.fixedAllowances)
                 * workDayRatio(p.actualWorkDays, p.standardWorkDays);

  if (p.role === "FM") {
    return fixedPay + p.seniorityBonus + p.commissionAmount + p.showPay
         + p.googleBonus + p.renewBonus;
  }

  // PT
  return fixedPay + p.seniorityBonus + p.commissionAmount + p.showPay
       + p.goalBonus + p.kocCommission + p.kolCommission;
}
