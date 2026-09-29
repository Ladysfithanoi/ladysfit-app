// Tách một lead nhiều gói thành từng gói để THỐNG KÊ NGUỒN cho đúng.
//
// Màn Lead ở Setup doanh số cho ghi nhiều gói trong một lead ("L3+L4+L5"). Về
// nghiệp vụ, chỉ gói ĐẦU TIÊN đến từ nguồn marketing của khách; từ gói thứ 2 trở
// đi là khách mua thêm — tức là Renew. Nếu đếm cả lead vào một nguồn thì nguồn
// Renew bị hụt và nguồn marketing bị thổi phồng. Đăng ký 3 gói = 1 gói theo nguồn
// của lead + 2 gói Renew; 4 gói = 1 + 3 Renew.
//
// Riêng gói trải nghiệm L0 đi chung với gói thật ("L0+L2"): L0 giữ nguồn của lead,
// gói ngay sau nó là "Hậu L0" (đúng luật cấn trừ ở lib/lead-pricing — Hậu L0 không
// tính là tái ký), từ gói tiếp theo mới là Renew.
//
// CHỈ dùng cho thống kê nguồn. Số khách, số hợp đồng và doanh thu tổng không đổi.
import {
  POST_L0_SOURCE,
  RENEW_SOURCE,
  computeExpectedRevenue,
  isRenewalSlot,
  parsePackageList,
  purchaseOrder,
} from "./lead-pricing";

export const UNKNOWN_SOURCE = "Không rõ nguồn";

export type SourceShare = {
  source: string;
  /** Tỉ trọng doanh thu của phần này trong lead, tổng các phần = 1. */
  weight: number;
};

export function splitLeadBySource(
  source: string | null | undefined,
  packageRegistered: string | null | undefined,
): SourceShare[] {
  const leadSource = source?.trim() || UNKNOWN_SOURCE;
  const packages = parsePackageList(packageRegistered);
  if (packages.length <= 1) return [{ source: leadSource, weight: 1 }];

  // Thứ tự khách THỰC SỰ mua: L0 trước, rồi gói giai đoạn thấp nhất — cùng luật
  // với giá hợp đồng (purchaseOrder ở lib/lead-pricing).
  const ordered = purchaseOrder(packages);

  // Chia doanh thu theo giá từng gói; có gói lạ không nằm trong bảng giá thì chia đều.
  const lines = computeExpectedRevenue(ordered, null)?.lines;
  const prices = lines?.map(l => l.final) ?? [];
  const priceSum = prices.reduce((s, p) => s + p, 0);
  const weightOf = (i: number) =>
    lines && priceSum > 0 ? prices[i] / priceSum : 1 / ordered.length;

  return ordered.map((pkg, i) => {
    // Cùng một luật "gói mua thêm" với giá hợp đồng (isRenewalSlot) — gói nào
    // được giá tái ký thì cũng chính gói đó được đếm vào nguồn Renew.
    let src: string;
    if (i === 0) src = leadSource;
    else if (isRenewalSlot(ordered, i, leadSource)) src = RENEW_SOURCE;
    else src = POST_L0_SOURCE;
    return { source: src, weight: weightOf(i) };
  });
}
