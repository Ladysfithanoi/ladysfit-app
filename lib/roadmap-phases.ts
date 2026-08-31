import { PACKAGES } from "@/lib/packages";

/**
 * ── Ba giai đoạn của lộ trình tập ────────────────────────────────────────────
 *
 * Bậc thang lấy ý từ mô hình OPT của NASM: xây nền trước, phát triển sau, rồi
 * mới tới giữ kết quả.
 *
 * Ba bậc này là MÔ HÌNH HUẤN LUYỆN, không phải ba `stage` thương mại của gói
 * tập trong lib/packages.ts. Đừng buộc hai thứ vào nhau: gói tập chỉ là thời
 * lượng và số buổi, gói nào lắp vào bậc nào cũng hợp lệ. Cái duy nhất chặn là
 * điều kiện thật của từng gói — xem `checkPick`.
 *
 * Vì thế vị trí bậc của một gói KHÔNG suy ra được từ tên gói; nó được lưu ở
 * cột consultation_packages.roadmapPhase. `phaseOf` bên dưới chỉ là đường lùi
 * cho những lộ trình lưu từ trước khi có bậc thang.
 */

export type PhaseNum = 1 | 2 | 3;

export type RoadmapPhase = {
  num: PhaseNum;
  stage: "1" | "2" | "3";
  name: string;
  tagline: string;
  theme: {
    /** Nền của bậc thang. */
    surface: string;
    /** Mặt bậc (dải màu trên đầu thẻ). */
    tread: string;
    /** Chữ trên nền surface. */
    text: string;
    /** Viền thẻ. */
    border: string;
    /** Huy hiệu số thứ tự. */
    badge: string;
  };
};

/**
 * Gói ghép được vào bậc thang — cùng một danh sách cho cả ba bậc, đúng thứ tự
 * khách hàng thấy trong "Danh sách lộ trình Ladysfit".
 *
 * Gói "Cư dân" và hợp đồng "KOC" cố tình không có ở đây: đó là chương trình
 * riêng (tài trợ / hợp tác, giá 0đ, không tính doanh số), không phải gói bán
 * để xếp vào lộ trình tư vấn.
 */
export const ROADMAP_PACKAGES = ["L0", "L1", "L2", "L3", "L4", "L5", "Loyalfit"];

export const ROADMAP_PHASES: RoadmapPhase[] = [
  {
    num: 1,
    stage: "1",
    name: "Thiết lập nền tảng",
    tagline: "Làm quen chuyển động, giảm mỡ nhanh",
    theme: {
      surface: "bg-rose-50",
      tread: "bg-rose-200",
      text: "text-rose-700",
      border: "border-rose-200",
      badge: "bg-rose-500",
    },
  },
  {
    num: 2,
    stage: "2",
    name: "Phát triển toàn diện",
    tagline: "Tạo hình, hoàn thiện vóc dáng",
    theme: {
      surface: "bg-blue-50",
      tread: "bg-blue-200",
      text: "text-blue-700",
      border: "border-blue-200",
      badge: "bg-blue-500",
    },
  },
  {
    num: 3,
    stage: "3",
    name: "Duy trì sức khoẻ",
    tagline: "Giữ kết quả, duy trì thói quen",
    theme: {
      surface: "bg-emerald-50",
      tread: "bg-emerald-200",
      text: "text-emerald-700",
      border: "border-emerald-200",
      badge: "bg-emerald-500",
    },
  },
];

/**
 * Bậc "tự nhiên" của một gói, suy từ giai đoạn thương mại của nó.
 *
 * CHỈ dùng làm đường lùi: xếp tạm những gói được lưu trước khi có cột
 * roadmapPhase, và chọn bậc mặc định cho ba lộ trình dựng sẵn. Không dùng để
 * chặn gói — mọi gói đều ghép được vào mọi bậc.
 */
export function phaseOf(packageName: string): PhaseNum | null {
  const stage = PACKAGES[packageName]?.stage;
  const phase = ROADMAP_PHASES.find((p) => p.stage === stage);
  return phase?.num ?? null;
}

// ── Điều kiện cân nặng để vào L1 / L2 ────────────────────────────────────────
// "Cân nặng thực > chiều cao tối thiểu N kg", tức weight − (height − 100) ≥ N.
// Ngưỡng lấy theo điều kiện ghi trên gói (lib/packages.ts) và trong danh sách
// lộ trình mà khách được xem. Đây cũng là ngưỡng bộ dựng ba lộ trình tự động ở
// step5-sales dùng — một nguồn duy nhất, đừng chép số ra chỗ khác.
//
// Mốc 7 kg ở trang tổng quan là chuyện KHÁC: đó là điều kiện transform (khách
// đủ mỡ thừa để giảm được 7 kg), không liên quan tới việc chọn gói.

export const L1_MIN_MARGIN = 3;
export const L2_MIN_MARGIN = 6;

export type RoadmapProfile = {
  /** Cân nặng hiện tại (kg). 0 = chưa có số liệu. */
  weight: number;
  /** Chiều cao (cm). 0 = chưa có số liệu. */
  height: number;
};

/**
 * Số kg khách đang dư so với chiều cao: weight − height + 100.
 * Trả null khi chưa nhập đủ cân nặng / chiều cao — lúc đó không chặn gì cả,
 * vì thiếu số liệu mà đi ẩn gói thì tư vấn viên không hiểu tại sao gói biến mất.
 */
export function weightMargin(profile: RoadmapProfile): number | null {
  if (profile.weight > 0 && profile.height > 0) {
    return profile.weight - profile.height + 100;
  }
  return null;
}

export type PickCheck = { ok: true } | { ok: false; reason: string };

/**
 * Gói này có ghép vào lộ trình được không.
 *
 * `chosenBefore` là các gói đã đứng TRƯỚC vị trí đang thêm (tính xuyên suốt cả
 * ba bậc), `chosenAll` là toàn bộ gói đang có trong lộ trình.
 */
export function checkPick(
  packageName: string,
  opts: {
    profile: RoadmapProfile;
    chosenBefore: string[];
    chosenAll: string[];
  }
): PickCheck {
  const def = PACKAGES[packageName];
  if (!def) return { ok: false, reason: "Không tìm thấy gói tập này" };

  // Gói chỉ mua được một lần thì trong lộ trình cũng chỉ xuất hiện một lần.
  if (!def.canBuyMultiple && opts.chosenAll.includes(packageName)) {
    return { ok: false, reason: "Gói này chỉ mua được 1 lần, đã có trong lộ trình" };
  }

  // Loyalfit là gói tri ân — phải có hợp đồng trước đó mới được mua, nên không
  // bao giờ là gói mở đầu lộ trình.
  if (packageName === "Loyalfit" && opts.chosenBefore.length === 0) {
    return {
      ok: false,
      reason: "Chỉ dành cho khách đã từng mua gói tại LDF — cần có gói khác đứng trước",
    };
  }

  // Giai đoạn 1 cần khách còn đủ mỡ thừa để giảm nhanh.
  const margin = weightMargin(opts.profile);
  if (margin !== null) {
    if (packageName === "L1" && margin < L1_MIN_MARGIN) {
      return {
        ok: false,
        reason: `Khách chỉ dư ${margin.toFixed(1)} kg so với chiều cao, L1 cần tối thiểu ${L1_MIN_MARGIN} kg`,
      };
    }
    if (packageName === "L2" && margin < L2_MIN_MARGIN) {
      return {
        ok: false,
        reason: `Khách chỉ dư ${margin.toFixed(1)} kg so với chiều cao, L2 cần tối thiểu ${L2_MIN_MARGIN} kg`,
      };
    }
  }

  return { ok: true };
}

/** Tổng số ngày của một chuỗi gói. */
export function sumDays(packageNames: string[]): number {
  return packageNames.reduce((s, name) => s + (PACKAGES[name]?.durationDays ?? 0), 0);
}

/** "~6 tháng · 180 ngày" — 0 ngày thì trả chuỗi rỗng. */
export function fmtDuration(days: number): string {
  if (days <= 0) return "";
  const months = Math.round(days / 30);
  return months >= 1 ? `~${months} tháng · ${days} ngày` : `${days} ngày`;
}
