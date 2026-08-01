import { prisma } from "@/lib/prisma";

/**
 * Định nghĩa doanh số dùng cho bảng lương — PHẢI khớp với "Tổng doanh thu" bên Setup.
 *
 * Setup (monthly-stats, ceo-summary, weekly actuals) cộng actualRevenue của MỌI lead
 * trong tháng, không lọc theo trạng thái. Bảng lương trước đây chỉ lấy PIF/DE/PB nên
 * ra số thấp hơn Setup (VD Mỹ Đình 7/2026: Setup 212.5tr, lương 177.5tr).
 *
 * Mọi truy vấn đều khoá theo branchId: một khách được chuyển sang cơ sở khác thì doanh
 * số đi theo cơ sở mới, nhờ vậy tổng doanh số các nhân sự luôn nằm trong doanh số phòng.
 *
 * actualRevenue lưu theo đơn vị triệu đồng → nhân 1.000.000 để ra VND.
 */

const TO_VND = 1_000_000;

/** Doanh số cả phòng tập trong tháng (VND) — dùng cho hoa hồng FM. */
export async function getBranchRevenue(branchId: string, month: number, year: number): Promise<number> {
  const agg = await prisma.salesLead.aggregate({
    where: { branchId, month, year },
    _sum: { actualRevenue: true },
  });
  return Number(agg._sum.actualRevenue ?? 0) * TO_VND;
}

/** Doanh số cá nhân của một PT/Admin tại một cơ sở trong tháng (VND). */
export async function getUserRevenue(
  userId: string,
  branchId: string,
  month: number,
  year: number,
): Promise<number> {
  const agg = await prisma.salesLead.aggregate({
    where: { assignedPTId: userId, branchId, month, year },
    _sum: { actualRevenue: true },
  });
  return Number(agg._sum.actualRevenue ?? 0) * TO_VND;
}
