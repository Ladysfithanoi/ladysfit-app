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
};

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
