import { workDayRatio } from "@/lib/work-days";

/**
 * Công thức tổng lương dùng chung cho mọi nơi tạo/tính lại bảng lương
 * (tạo bảng lương, GET tính lại theo doanh số mới, PUT khi FM sửa ngày công).
 *
 * Lương cứng = (lương cơ bản + phụ cấp cố định) / 26 × số ngày được trả lương
 * (nghỉ trừ ngày, tháng hơn 26 ngày công chuẩn được cộng ngày dư — xem
 * workDayRatio ở lib/work-days). Hoa hồng, tiền buổi dạy, thâm niên và các khoản thưởng KHÔNG bị chia
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

  // STAFF (lao công, marketing…) không bán gói, không dạy khách — chỉ có lương
  // cứng theo ngày công.
  if (p.role === "STAFF") return fixedPay;

  // FM cũng đi dạy: buổi dạy khách KOL (60k/buổi) và thưởng hợp đồng KOC trả
  // cho NGƯỜI DẠY như PT. Trước đây công thức FM bỏ hai khoản này, nên FM dạy
  // khách KOL không được đồng nào cho những buổi đó.
  if (p.role === "FM") {
    return fixedPay + p.seniorityBonus + p.commissionAmount + p.showPay
         + p.googleBonus + p.renewBonus + p.kocCommission + p.kolCommission;
  }

  // PT
  return fixedPay + p.seniorityBonus + p.commissionAmount + p.showPay
       + p.goalBonus + p.kocCommission + p.kolCommission;
}

/**
 * Mức đóng BHXH = LƯƠNG CƠ BẢN (PT mặc định 5.310.000đ). Lương thâm niên là
 * phần LƯƠNG CỘNG THÊM nên không nằm trong mức đóng, phụ cấp cũng vậy. Trước
 * đây mức đóng của PT ghi cứng 4.960.000đ, lệch khỏi lương cơ bản thật.
 *
 * STAFF và Admin dạy thêm không đóng BHXH qua bảng lương này.
 */
export function bhxhBaseOf(role: string, baseSalary: number): number {
  return role === "PT" || role === "FM" ? baseSalary : 0;
}
