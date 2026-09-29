import { PACKAGES, TRIAL_PACKAGE } from "@/lib/packages";
import { POST_L0_CREDIT } from "@/lib/lead-pricing";
import { promoPriceFor, renewDiscountFor, type ActivePromo, type RenewDiscount } from "@/lib/package-promos";

/**
 * ── Giá một lộ trình ─────────────────────────────────────────────────────────
 *
 * Ba mức giá, quyết định bởi VỊ TRÍ của gói trong lộ trình chứ không phải bản
 * thân gói:
 *
 *   • Gói đầu tiên, nếu là L1 hoặc L2 → giá trợ giá cho khách mua lần đầu.
 *   • Gói đầu tiên, các trường hợp khác → nguyên giá.
 *   • Từ gói thứ hai trở đi → giảm giá tái ký (mặc định 10%; đợt trợ giá của
 *     cơ sở đổi được con số này — xem renewDiscountFor ở lib/package-promos).
 *   • Riêng Loyalfit → luôn nguyên giá, không trợ giá cũng không giảm tái ký.
 *
 * Gói trải nghiệm L0 KHÔNG tính là "gói đầu tiên": khách tập thử xong mới vào lộ
 * trình thật, nên gói thật đầu tiên sau L0 vẫn được giá trợ giá / nguyên giá như
 * mọi khách mới. 2 triệu đã đóng cho L0 được cấn trừ vào gói NGAY SAU nó — gói
 * nào cũng vậy, kể cả Loyalfit. Đúng luật mà Setup doanh số dùng để đối chiếu
 * tiền hợp đồng (postL0Credit ở lib/lead-pricing).
 *
 * Trên ba mức đó còn có các ĐỢT TRỢ GIÁ riêng của từng cơ sở, có ngày hết hạn —
 * xem lib/package-promos. Đợt nào đang chạy mà rẻ hơn mức thường trực thì khách
 * hưởng mức rẻ hơn; hết hạn là giá tự trả về bình thường.
 *
 * Dùng chung cho bảng gói ở bước Tư vấn lộ trình và cho nút Báo giá của bậc
 * thang, để hai chỗ không bao giờ báo hai con số khác nhau cho cùng một lộ trình.
 */

export type PriceType = "subsidized" | "full" | "renewal" | "promo";

export type PriceLine = {
  packageName: string;
  originalPrice: number;
  effectivePrice: number;
  type: PriceType;
  /** Nhãn đợt trợ giá đang áp, chỉ có khi type = "promo". */
  promoLabel?: string;
  /** % giảm tái ký đã áp, chỉ có khi type = "renewal". */
  renewPct?: number;
  /** Tiền L0 đã cấn trừ vào gói này (đồng) — chỉ gói ngay sau L0. */
  l0Credit?: number;
};

/** Giá thường trực, chưa xét đợt trợ giá của cơ sở. */
function standardLine(name: string, index: number, renew: RenewDiscount): PriceLine {
  const def = PACKAGES[name];
  if (!def) {
    return { packageName: name, originalPrice: 0, effectivePrice: 0, type: "full" };
  }

  if (name === "Loyalfit") {
    return { packageName: name, originalPrice: def.price, effectivePrice: def.price, type: "full" };
  }

  if (index === 0) {
    if (name === "L1" || name === "L2") {
      return {
        packageName: name,
        originalPrice: def.price,
        effectivePrice: def.discountedPrice ?? def.price,
        type: "subsidized",
      };
    }
    return { packageName: name, originalPrice: def.price, effectivePrice: def.price, type: "full" };
  }

  return {
    packageName: name,
    originalPrice: def.price,
    effectivePrice: Math.round(def.price * (1 - renew.pct / 100)),
    type: "renewal",
    renewPct: renew.pct,
  };
}

/**
 * Giá từng gói theo đúng thứ tự chúng nằm trong lộ trình.
 *
 * `promos` là các đợt trợ giá ĐANG CHẠY ở cơ sở đó (lọc sẵn ở
 * lib/package-promos-server). Bỏ trống thì chỉ có giá thường trực — an toàn cho
 * những chỗ chưa biết cơ sở, không bao giờ báo nhầm giá rẻ.
 */
export function priceRoadmap(packageNames: string[], promos?: ActivePromo[] | null): PriceLine[] {
  const renew = renewDiscountFor(promos);
  let realIndex = 0;
  return packageNames.map((name, index) => {
    // L0 đứng ngoài thứ tự "gói đầu / gói tái ký" — xem chú thích đầu file.
    const position = name === TRIAL_PACKAGE ? 0 : realIndex++;
    let line = standardLine(name, position, renew);
    const promo = promoPriceFor(name, promos);

    // Chỉ đổi khi đợt trợ giá THẬT SỰ rẻ hơn mức thường trực — khách luôn được
    // mức tốt nhất, và một đợt kém hơn giá tái ký không bao giờ làm khách thiệt.
    if (promo && promo.price < line.effectivePrice) {
      line = { ...line, effectivePrice: promo.price, type: "promo", promoLabel: promo.shortLabel };
    }

    // Gói ngay sau L0 được cấn trừ tiền L0 đã đóng.
    if (index > 0 && packageNames[index - 1] === TRIAL_PACKAGE && name !== TRIAL_PACKAGE) {
      const credit = Math.min(POST_L0_CREDIT * 1_000_000, line.effectivePrice);
      line = { ...line, effectivePrice: line.effectivePrice - credit, l0Credit: credit };
    }
    return line;
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
  renewal: "Giá tái ký",
  promo: "Đợt trợ giá",
};

/** Nhãn hiện cạnh giá — đợt trợ giá thì lấy tên đợt cho rõ đang áp cái gì. */
export function priceLineLabel(line: PriceLine): string {
  const base =
    line.type === "promo" && line.promoLabel ? line.promoLabel
      : line.type === "renewal" && line.renewPct != null ? `Giá tái ký (-${line.renewPct}%)`
        : PRICE_TYPE_LABEL[line.type];
  return line.l0Credit ? `${base} · trừ ${line.l0Credit / 1_000_000}tr đã đóng L0` : base;
}
