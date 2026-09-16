import {
  RESIDENT_PACKAGE,
  TRIAL_PACKAGE,
  SESSION_PAY_L1_L2_LOYAL,
  SESSION_PAY_L3_L4_L5,
  SESSION_PAY_RESIDENT,
  SESSION_PAY_TRIAL,
  SESSION_PAY_TRANSFER,
} from "@/lib/packages";

/**
 * ── Tiền buổi dạy: một đường duy nhất ───────────────────────────────────────
 *
 * Buổi dạy được xếp vào một RỔ theo đơn giá, rồi mỗi rổ nhân với đơn giá của
 * nó ra tiền buổi dạy. Cùng một cách chia ở mọi nơi: màn tạo bảng lương, bảng
 * lương của PT, và phần tính lại thời gian thực — ba chỗ đó từng chép lại công
 * thức của nhau nên thêm một bậc đơn giá là lệch ngay một chỗ.
 *
 * Khách CHUYỂN GIAO đi rổ riêng vì đơn giá của họ (50.000đ) không bám theo gói.
 * KOL không có rổ nào — hợp đồng KOL trả hoa hồng 60.000đ/buổi ở đường khác.
 */

export type ShowBuckets = {
  showsL1L2Loyal: number;
  showsL3L4L5:    number;
  showsResident:  number;
  showsL0:        number;
  /** Buổi dạy khách chuyển giao — 50.000đ/buổi bất kể gói. */
  showsTransfer:  number;
};

export type TaughtLike = { packageName: string; contractType: string };

const L1_L2_LOYAL = new Set(["L1", "L2", "Loyalfit"]);

export function emptyBuckets(): ShowBuckets {
  return { showsL1L2Loyal: 0, showsL3L4L5: 0, showsResident: 0, showsL0: 0, showsTransfer: 0 };
}

/** Rổ đơn giá của một buổi dạy; null = không tính vào tiền buổi dạy (KOL). */
export function bucketOf(row: TaughtLike): keyof ShowBuckets | null {
  if (row.contractType === "KOL") return null;
  if (row.contractType === "TRANSFER") return "showsTransfer";
  if (row.packageName === RESIDENT_PACKAGE) return "showsResident";
  if (row.packageName === TRIAL_PACKAGE) return "showsL0";
  if (L1_L2_LOYAL.has(row.packageName)) return "showsL1L2Loyal";
  return "showsL3L4L5";
}

/** Tiền buổi dạy của một bộ rổ. */
export function showPayOf(b: Partial<ShowBuckets>): number {
  return (b.showsL1L2Loyal ?? 0) * SESSION_PAY_L1_L2_LOYAL
       + (b.showsL3L4L5    ?? 0) * SESSION_PAY_L3_L4_L5
       + (b.showsResident  ?? 0) * SESSION_PAY_RESIDENT
       + (b.showsL0        ?? 0) * SESSION_PAY_TRIAL
       + (b.showsTransfer  ?? 0) * SESSION_PAY_TRANSFER;
}

export function totalShows(b: Partial<ShowBuckets>): number {
  return (b.showsL1L2Loyal ?? 0) + (b.showsL3L4L5 ?? 0)
       + (b.showsResident  ?? 0) + (b.showsL0     ?? 0)
       + (b.showsTransfer  ?? 0);
}

/**
 * Xếp buổi đã dạy (+ phần Admin/FM chỉnh tay) vào rổ. Trừ tay quá đà không được
 * để số buổi âm.
 */
export function tallyShows(
  taught:      TaughtLike[],
  adjustments: (TaughtLike & { delta: number })[] = [],
): ShowBuckets {
  const b = emptyBuckets();

  for (const row of taught) {
    const key = bucketOf(row);
    if (key) b[key] += 1;
  }
  for (const adj of adjustments) {
    const key = bucketOf(adj);
    if (key) b[key] += adj.delta;
  }

  for (const key of Object.keys(b) as (keyof ShowBuckets)[]) {
    b[key] = Math.max(0, b[key]);
  }
  return b;
}
