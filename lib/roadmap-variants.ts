import { PACKAGES } from "@/lib/packages";
import { L1_MIN_MARGIN, L2_MIN_MARGIN } from "@/lib/roadmap-phases";

/**
 * ── Các cách ghép gói khác nhau cho cùng một khoảng thời gian ────────────────
 *
 * Ba OPTION ở bước Tư vấn lộ trình khác nhau ở TỔNG THỜI GIAN đi cùng khách
 * (ngắn / vừa / dài). Nhưng cùng một khoảng thời gian thì có nhiều cách ghép
 * gói: một gói L4 180 ngày, hay hai gói L3 mỗi gói 120 ngày; duy trì bằng L5
 * 180 ngày, hay Loyalfit 90 ngày.
 *
 * Chỗ này sinh ra các cách ghép đó rồi xếp theo mức bám sát thời lượng của
 * option đã chọn, để khách tự chọn kiểu đi hợp với mình — miễn tổng thời gian
 * vẫn xấp xỉ như đã thống nhất.
 *
 * Giai đoạn 1 KHÔNG được thay đổi ở đây: gói nào là do cân nặng so với chiều
 * cao quyết định, không phải do khách thích.
 */

export type RoadmapVariant = {
  /** Chữ ký của chuỗi gói — dùng làm khoá và để loại trùng. */
  key: string;
  packageNames: string[];
  totalDays: number;
  /** Lệch bao nhiêu ngày so với thời lượng của option đã chọn (âm = ngắn hơn). */
  diffDays: number;
  /** true = đúng chuỗi mà option đề xuất sẵn. */
  isDefault: boolean;
};

/** Số gói Giai đoạn 2 tối đa trong một lộ trình — quá nữa thì không còn thực tế. */
const MAX_PHASE2 = 4;

const PHASE2_POOL = ["L3", "L4"] as const;
const PHASE3_POOL = ["L5", "Loyalfit"] as const;

/**
 * Gói Giai đoạn 1 phù hợp với thể trạng khách, hoặc null nếu khách không đủ
 * mỡ thừa để vào chặng giảm nhanh.
 *
 * Ngưỡng lấy từ lib/roadmap-phases — cùng nguồn với bộ lọc của bậc thang, đừng
 * chép số ra đây.
 */
export function phase1KeyFor(weight: number, height: number): string | null {
  if (height > 0 && weight > 0) {
    const margin = weight - height + 100;
    if (margin >= L2_MIN_MARGIN) return "L2";
    if (margin >= L1_MIN_MARGIN) return "L1";
  }
  return null;
}

function daysOf(names: string[]): number {
  return names.reduce((s, n) => s + (PACKAGES[n]?.durationDays ?? 0), 0);
}

/**
 * Các cách ghép gói cho một option, xếp từ bám sát thời lượng nhất trở đi.
 *
 * Chuỗi mà option đề xuất sẵn luôn đứng đầu — đó là phương án chuẩn, các
 * phương án sau chỉ là lựa chọn thay thế.
 */
export function buildRoadmapVariants(opts: {
  phase1Key: string | null;
  /** Chuỗi gói option đề xuất sẵn. */
  defaultChain: string[];
  /** Số phương án trả về, kể cả chuỗi mặc định. */
  max?: number;
}): RoadmapVariant[] {
  const max = opts.max ?? 3;
  const targetDays = daysOf(opts.defaultChain);

  const seen = new Set<string>();
  const out: RoadmapVariant[] = [];

  const defaultKey = opts.defaultChain.join(">");
  seen.add(defaultKey);
  out.push({
    key: defaultKey,
    packageNames: [...opts.defaultChain],
    totalDays: targetDays,
    diffDays: 0,
    isDefault: true,
  });

  // Duyệt mọi cách ghép Giai đoạn 2 (số gói L3 / L4) và cách kết thúc Giai đoạn 3.
  const candidates: RoadmapVariant[] = [];
  for (let l3 = 0; l3 <= MAX_PHASE2; l3++) {
    for (let l4 = 0; l4 <= MAX_PHASE2; l4++) {
      const count = l3 + l4;
      if (count < 1 || count > MAX_PHASE2) continue;
      for (const phase3 of PHASE3_POOL) {
        const chain = [
          ...(opts.phase1Key ? [opts.phase1Key] : []),
          ...Array(l3).fill(PHASE2_POOL[0]),
          ...Array(l4).fill(PHASE2_POOL[1]),
          phase3,
        ];
        const key = chain.join(">");
        if (seen.has(key)) continue;
        const totalDays = daysOf(chain);
        candidates.push({
          key,
          packageNames: chain,
          totalDays,
          diffDays: totalDays - targetDays,
          isDefault: false,
        });
      }
    }
  }

  // Gần thời lượng gốc nhất trước; bằng nhau thì ưu tiên chuỗi ít gói hơn cho
  // khách đỡ phải ký nhiều hợp đồng.
  candidates.sort((a, b) => {
    const d = Math.abs(a.diffDays) - Math.abs(b.diffDays);
    if (d !== 0) return d;
    return a.packageNames.length - b.packageNames.length;
  });

  for (const c of candidates) {
    if (out.length >= max) break;
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c);
  }

  return out;
}

/** "3 gói · 1 gói Giai đoạn 2 · duy trì bằng L5" */
export function describeVariant(packageNames: string[]): string {
  const phase2 = packageNames.filter((n) => PACKAGES[n]?.stage === "2");
  const phase3 = packageNames.find((n) => PACKAGES[n]?.stage === "3");
  const parts = [`${packageNames.length} gói`];
  if (phase2.length > 0) parts.push(`${phase2.length} gói Giai đoạn 2`);
  if (phase3) parts.push(`duy trì bằng ${phase3}`);
  return parts.join(" · ");
}
