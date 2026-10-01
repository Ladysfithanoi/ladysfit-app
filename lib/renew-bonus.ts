import { prisma } from "@/lib/prisma";
import { isRenewalSlot, parsePackageList, purchaseOrder } from "@/lib/lead-pricing";

// ── Thưởng Renew của FM — tự đếm từ Setup doanh số ──────────────────────────
//
// Mỗi GÓI RENEW thưởng một lần. Gói nào là renew dùng đúng luật "gói mua thêm"
// của giá hợp đồng (isRenewalSlot) — gói được giá tái ký thì cũng chính gói đó
// được thưởng renew, hai bên không thể lệch nhau:
//   • Lead nguồn Renew (khách cũ mua tiếp): mọi gói thật đều là renew.
//   • Khách mới mua nhiều gói một lần: gói đầu không tính, từ gói 2 là renew —
//     2 gói = 1 renew, 3 gói = 2 renew…
//   • Combo L0 + 1 gói tập: L0 không phải gói thật, gói ngay sau L0 là Hậu L0 →
//     không có renew nào. L0 + 2 gói thì gói thứ hai mới là renew.
//
// CHỈ ĐẾM LEAD ĐÃ CHỐT HỢP ĐỒNG LẦN ĐẦU (Đặt cọc / Đã thanh toán). Dòng Thanh
// toán nốt (PB) là đợt thu tiếp của một hợp đồng đã cọc từ trước — có cả dòng cũ
// không nối payoffOfId — nên đếm nó là thưởng hai lần cho cùng một hợp đồng.
//
// Kỳ thưởng theo month/year của lead, cùng kỳ với doanh số phòng mà FM hưởng
// hoa hồng (lib/salary-revenue).

export const RENEW_BONUS_AMOUNT = 150_000;

const CONTRACT_STATUSES = ["DE", "PIF"] as const;

/** Số gói renew trong một lead. */
export function renewCountOfLead(
  source: string | null | undefined,
  packageRegistered: string | null | undefined,
): number {
  const ordered = purchaseOrder(parsePackageList(packageRegistered));
  const src = source?.trim() || null;
  let n = 0;
  for (let i = 0; i < ordered.length; i++) {
    if (isRenewalSlot(ordered, i, src)) n++;
  }
  return n;
}

/** Tổng số gói renew của cả cơ sở trong tháng. */
export async function getBranchRenewCount(branchId: string, month: number, year: number): Promise<number> {
  const leads = await prisma.salesLead.findMany({
    where: { branchId, month, year, status: { in: [...CONTRACT_STATUSES] } },
    select: { source: true, packageRegistered: true },
  });
  return leads.reduce((s, l) => s + renewCountOfLead(l.source, l.packageRegistered), 0);
}
