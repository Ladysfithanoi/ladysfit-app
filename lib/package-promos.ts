/**
 * ── Chương trình trợ giá theo cơ sở, có hạn ─────────────────────────────────
 *
 * Khác với ba mức giá thường trực ở lib/roadmap-pricing (trợ giá L1/L2, nguyên
 * giá, tái ký −10%) — những mức đó áp cho MỌI cơ sở và không có ngày hết hạn.
 * Chỗ này dành cho các đợt bán hàng riêng của một cơ sở, tự hết hiệu lực khi
 * qua ngày: hết hạn là giá tự trả về bình thường, không ai phải nhớ đi tắt.
 *
 * Giá ghi ở đây là GIÁ CUỐI khách trả cho gói đó, không phải phần trăm giảm —
 * ghi thẳng số tiền để không bao giờ có chuyện làm tròn ra một con số lạ trên
 * hợp đồng.
 *
 * Đây là nguồn duy nhất: cả bảng giá lúc tư vấn, nút Báo giá của bậc thang và
 * giá ghi vào hợp đồng lúc hoàn thành tư vấn đều đọc từ đây.
 */

export type PackagePromo = {
  /** Tên đợt, hiện cho tư vấn viên thấy đang áp chương trình nào. */
  name: string;
  /** Nhãn ngắn gọn đứng cạnh giá. */
  shortLabel: string;
  /** Cơ sở áp dụng — so khớp bỏ dấu, không phân biệt hoa thường. */
  branchNames: string[];
  /** Giá cuối theo tên gói. */
  prices: Record<string, number>;
  /** Áp dụng từ thời điểm này (tính cả). */
  from: string;
  /** Hết hiệu lực từ thời điểm này (KHÔNG tính) — đặt ở đầu ngày kế tiếp. */
  until: string;
};

export const PACKAGE_PROMOS: PackagePromo[] = [
  {
    name: "Presale trợ giá 30% — Ladysfit Trần Duy Hưng",
    shortLabel: "Presale −30%",
    branchNames: ["Ladysfit Trần Duy Hưng"],
    // L3 25.000.000 → 17.500.000 · L4 45.000.000 → 31.500.000 (đúng −30%).
    prices: { L3: 17_500_000, L4: 31_500_000 },
    from:  "2026-09-01T00:00:00+07:00",
    // Hết ngày 30/09/2026 theo giờ Việt Nam.
    until: "2026-10-01T00:00:00+07:00",
  },
];

/** Bỏ dấu + thường hoá để so tên cơ sở không phụ thuộc cách gõ. */
function normalizeBranch(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

export type PromoContext = {
  /** Tên cơ sở của buổi tư vấn / hợp đồng. */
  branchName?: string | null;
  /** Thời điểm xét, mặc định là bây giờ. */
  at?: Date;
};

export type PromoHit = {
  price: number;
  promoName: string;
  shortLabel: string;
};

/**
 * Giá trợ giá đang có hiệu lực cho một gói ở một cơ sở, hoặc null nếu không có.
 *
 * Nhiều đợt cùng phủ một gói thì lấy giá THẤP NHẤT — khách luôn được mức tốt
 * nhất đang chạy, không phụ thuộc thứ tự khai báo.
 */
export function promoPriceFor(packageName: string, ctx?: PromoContext): PromoHit | null {
  const branch = ctx?.branchName ? normalizeBranch(ctx.branchName) : null;
  if (!branch) return null;

  const now = (ctx?.at ?? new Date()).getTime();
  let best: PromoHit | null = null;

  for (const promo of PACKAGE_PROMOS) {
    if (!promo.branchNames.some((b) => normalizeBranch(b) === branch)) continue;
    if (now < new Date(promo.from).getTime()) continue;
    if (now >= new Date(promo.until).getTime()) continue;

    const price = promo.prices[packageName];
    if (price == null) continue;
    if (best == null || price < best.price) {
      best = { price, promoName: promo.name, shortLabel: promo.shortLabel };
    }
  }

  return best;
}

/** Các đợt đang chạy ở một cơ sở — dùng để báo cho tư vấn viên biết. */
export function activePromos(ctx?: PromoContext): PackagePromo[] {
  const branch = ctx?.branchName ? normalizeBranch(ctx.branchName) : null;
  if (!branch) return [];
  const now = (ctx?.at ?? new Date()).getTime();

  return PACKAGE_PROMOS.filter(
    (p) =>
      p.branchNames.some((b) => normalizeBranch(b) === branch) &&
      now >= new Date(p.from).getTime() &&
      now < new Date(p.until).getTime()
  );
}
