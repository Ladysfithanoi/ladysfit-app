/**
 * ── Chương trình trợ giá theo cơ sở, có hạn ─────────────────────────────────
 *
 * Khác với ba mức giá thường trực ở lib/roadmap-pricing (trợ giá L1/L2, nguyên
 * giá, tái ký −10%) — những mức đó áp cho MỌI cơ sở và không có ngày hết hạn.
 * Đây là các đợt bán hàng riêng của một cơ sở, do Admin tự khai ở màn Cài đặt →
 * Trợ giá, và tự hết hiệu lực khi qua ngày: hết hạn là giá tự trả về bình
 * thường, không ai phải nhớ đi tắt.
 *
 * Giá lưu là GIÁ CUỐI khách trả cho gói đó, không phải phần trăm giảm — để
 * không bao giờ có chuyện làm tròn ra một con số lạ trên hợp đồng.
 *
 * File này CỐ Ý không đụng tới Prisma: nó chạy cả ở trình duyệt (bảng giá lúc
 * tư vấn). Phần đọc DB nằm ở lib/package-promos-server.ts, và mọi nơi đều nhận
 * cùng một danh sách đợt đã lọc sẵn để không có hai định nghĩa "đang chạy".
 */

export type PromoItem = {
  packageName: string;
  price: number;
};

/** Một đợt trợ giá đã được lọc là ĐANG CHẠY, dạng gửi được xuống client. */
export type ActivePromo = {
  id: string;
  name: string;
  shortLabel: string;
  /** Thời điểm cuối cùng còn áp, ISO — dùng để hiện "áp dụng đến hết ngày...". */
  endsAt: string;
  items: PromoItem[];
  /** % trợ giá tái ký trong đợt này; null/thiếu = không đổi mức mặc định. */
  renewDiscountPct?: number | null;
};

// ── Trợ giá tái ký ─────────────────────────────────────────────────────────
//
// Gói mua thêm (tái ký) được giảm một tỉ lệ trên giá niêm yết. Mặc định 10%;
// Admin đổi được theo từng đợt trợ giá của cơ sở (Cài đặt → Trợ giá), và hết
// đợt là tự về 10%. Bảng giá lúc tư vấn (lib/roadmap-pricing) và giá hợp đồng ở
// Setup doanh số (lib/lead-pricing) đều hỏi đúng hàm này — không chỗ nào tự
// giữ con số 10% riêng.

export const DEFAULT_RENEW_DISCOUNT_PCT = 10;
/** Trần an toàn, chặn gõ nhầm 100% thành bán không đồng. */
export const MAX_RENEW_DISCOUNT_PCT = 50;

export type RenewDiscount = {
  /** Phần trăm giảm, vd 10 hay 15. */
  pct: number;
  /** Nhãn ngắn của đợt đặt ra mức này; không có = mức mặc định. */
  promoLabel?: string;
};

/**
 * Mức trợ giá tái ký đang áp. Nhiều đợt cùng đặt thì lấy mức CAO NHẤT — khách
 * luôn được mức tốt nhất đang chạy, cùng luật với giá gói ở promoPriceFor.
 */
export function renewDiscountFor(promos?: ActivePromo[] | null): RenewDiscount {
  let best: RenewDiscount | null = null;
  for (const p of promos ?? []) {
    const pct = p.renewDiscountPct;
    if (pct == null || !(pct >= 0)) continue;
    if (best == null || pct > best.pct) best = { pct, promoLabel: p.shortLabel };
  }
  return best ?? { pct: DEFAULT_RENEW_DISCOUNT_PCT };
}

/**
 * Đọc ô "% trợ giá tái ký" gửi lên: null/"" = không đổi mức mặc định. Trả về
 * `{ error }` khi số không hợp lệ. Dùng chung cho form và API để hai bên cùng luật.
 */
export function parseRenewDiscountPct(v: unknown): { value: number | null } | { error: string } {
  if (v == null || v === "") return { value: null };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > MAX_RENEW_DISCOUNT_PCT) {
    return { error: `% trợ giá tái ký phải từ 0 đến ${MAX_RENEW_DISCOUNT_PCT}.` };
  }
  return { value: Math.round(n * 10) / 10 };
}

export type PromoHit = {
  price: number;
  promoName: string;
  shortLabel: string;
};

/**
 * Giá trợ giá cho một gói trong số các đợt đang chạy, hoặc null nếu không đợt
 * nào phủ gói đó.
 *
 * Nhiều đợt cùng phủ một gói thì lấy giá THẤP NHẤT — khách luôn được mức tốt
 * nhất đang chạy, không phụ thuộc thứ tự khai báo.
 */
export function promoPriceFor(packageName: string, promos?: ActivePromo[] | null): PromoHit | null {
  if (!promos || promos.length === 0) return null;

  let best: PromoHit | null = null;
  for (const promo of promos) {
    for (const item of promo.items) {
      if (item.packageName !== packageName) continue;
      if (best == null || item.price < best.price) {
        best = { price: item.price, promoName: promo.name, shortLabel: promo.shortLabel };
      }
    }
  }
  return best;
}

// ── Ngày tháng theo giờ Việt Nam ────────────────────────────────────────────
//
// Admin nhập ngày ("2026-09-01"), còn DB lưu thời điểm. Hai hàm dưới đây là chỗ
// DUY NHẤT quy đổi giữa hai thứ đó, để form nhập, API và bảng giá không bao giờ
// hiểu lệch nhau một ngày.

const VN_OFFSET = "+07:00";

/** "2026-09-01" → thời điểm 00:00:00 ngày đó, giờ Việt Nam. */
export function vnStartOfDay(day: string): Date {
  return new Date(`${day}T00:00:00.000${VN_OFFSET}`);
}

/** "2026-09-30" → thời điểm 23:59:59.999 ngày đó, giờ Việt Nam. */
export function vnEndOfDay(day: string): Date {
  return new Date(`${day}T23:59:59.999${VN_OFFSET}`);
}

/** Thời điểm → "2026-09-30" theo giờ Việt Nam, để đổ ngược vào ô nhập ngày. */
export function vnDayString(at: Date | string): string {
  const d = new Date(at);
  const vn = new Date(d.getTime() + 7 * 3600_000);
  return `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, "0")}-${String(vn.getUTCDate()).padStart(2, "0")}`;
}

/** "30/09/2026" theo giờ Việt Nam. */
export function fmtVnDate(at: Date | string): string {
  const [y, m, d] = vnDayString(at).split("-");
  return `${d}/${m}/${y}`;
}
