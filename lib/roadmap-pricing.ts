import { PACKAGES } from "@/lib/packages";

/**
 * ── Giá một lộ trình ─────────────────────────────────────────────────────────
 *
 * Ba mức giá, quyết định bởi VỊ TRÍ của gói trong lộ trình chứ không phải bản
 * thân gói:
 *
 *   • Gói đầu tiên, nếu là L1 hoặc L2 → giá trợ giá cho khách mua lần đầu.
 *   • Gói đầu tiên, các trường hợp khác → nguyên giá.
 *   • Từ gói thứ hai trở đi → giảm 10% giá tái ký.
 *   • Riêng Loyalfit → luôn nguyên giá, không trợ giá cũng không giảm tái ký.
 *
 * Dùng chung cho bảng gói ở bước Tư vấn lộ trình và cho nút Báo giá của bậc
 * thang, để hai chỗ không bao giờ báo hai con số khác nhau cho cùng một lộ trình.
 */

export type PriceType = "subsidized" | "full" | "renewal";

export type PriceLine = {
  packageName: string;
  originalPrice: number;
  effectivePrice: number;
  type: PriceType;
};

/** Giá từng gói theo đúng thứ tự chúng nằm trong lộ trình. */
export function priceRoadmap(packageNames: string[]): PriceLine[] {
  return packageNames.map((name, index) => {
    const def = PACKAGES[name];
    if (!def) {
      return { packageName: name, originalPrice: 0, effectivePrice: 0, type: "full" as const };
    }

    if (name === "Loyalfit") {
      return {
        packageName: name,
        originalPrice: def.price,
        effectivePrice: def.price,
        type: "full" as const,
      };
    }

    if (index === 0) {
      if (name === "L1" || name === "L2") {
        return {
          packageName: name,
          originalPrice: def.price,
          effectivePrice: def.discountedPrice ?? def.price,
          type: "subsidized" as const,
        };
      }
      return {
        packageName: name,
        originalPrice: def.price,
        effectivePrice: def.price,
        type: "full" as const,
      };
    }

    return {
      packageName: name,
      originalPrice: def.price,
      effectivePrice: Math.round(def.price * 0.9),
      type: "renewal" as const,
    };
  });
}

export type QuoteTotals = {
  /** Tổng giá gốc, chưa trừ ưu đãi nào. */
  original: number;
  /** Số tiền khách thực trả. */
  effective: number;
  /** Phần được giảm — chênh lệch hai con số trên. */
  saved: number;
};

export function quoteTotals(lines: PriceLine[]): QuoteTotals {
  const original = lines.reduce((s, l) => s + l.originalPrice, 0);
  const effective = lines.reduce((s, l) => s + l.effectivePrice, 0);
  return { original, effective, saved: original - effective };
}

export const PRICE_TYPE_LABEL: Record<PriceType, string> = {
  subsidized: "Giá trợ giá",
  full: "Nguyên giá",
  renewal: "Giá tái ký (-10%)",
};
