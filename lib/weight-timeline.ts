/**
 * ── Thời gian cần thiết để hoàn thiện mục tiêu ───────────────────────────────
 *
 * Quy tắc bất biến của Ladysfit: tốc độ giảm cân an toàn KHÔNG cố định, nó
 * chậm dần khi khách càng về gần cân nặng chuẩn. Ba chặng, mốc lấy theo chiều
 * cao:
 *
 *   Chiều cao − 100                        = mốc chuẩn   (standardWeight)
 *   0.9 × (Chiều cao − 100)                = mốc đẹp     (idealWeight)
 *
 *   • Trên mốc chuẩn              → 1%    tổng trọng lượng hiện tại / tuần
 *   • Mốc chuẩn → mốc đẹp         → 0.75% tổng trọng lượng hiện tại / tuần
 *   • Dưới mốc đẹp                → 0.5%  tổng trọng lượng hiện tại / tuần
 *
 * "Tổng trọng lượng HIỆN TẠI" nghĩa là mỗi tuần lấy % trên cân nặng của chính
 * tuần đó, nên số kg giảm nhỏ dần theo cấp số nhân chứ không phải đều tay:
 *
 *   W(n) = W0 × (1 − r)^n   ⇒   n = ln(W1 / W0) / ln(1 − r)   (n tính bằng tuần)
 *
 * Đây là NGUỒN DUY NHẤT của quy tắc này. Chỗ nào cần ước lượng thời gian giảm
 * cân thì gọi vào đây, đừng chép công thức ra nơi khác.
 */

export const FAST_RATE   = 0.01;   // Giảm cân nhanh
export const MEDIUM_RATE = 0.0075; // Giảm cân vừa
export const SLOW_RATE   = 0.005;  // Giảm cân chậm

export type LossSpeed = "fast" | "medium" | "slow";

export type LossSegment = {
  speed: LossSpeed;
  /** "Giảm cân nhanh" */
  label: string;
  /** "1%" */
  ratePct: string;
  rate: number;
  /** Điều kiện cân nặng của chặng, để hiện dưới tiêu đề cột. */
  range: string;
  fromWeight: number;
  toWeight: number;
  /** Số kg rơi vào chặng này. 0 = khách không đi qua chặng này. */
  kg: number;
  weeks: number;
  days: number;
};

export type WeightTimeline = {
  currentWeight: number;
  /** Cân nặng đích thực sự dùng để tính. */
  goalWeight: number;
  /** true = khách chưa điền cân nặng mục tiêu, đang lấy tạm mốc đẹp. */
  goalIsSuggested: boolean;
  /** Chiều cao − 100 */
  standardWeight: number;
  /** 0.9 × (Chiều cao − 100) */
  idealWeight: number;
  totalKg: number;
  totalDays: number;
  totalWeeks: number;
  /** Luôn đủ 3 chặng theo thứ tự nhanh → vừa → chậm; chặng không đi qua có kg = 0. */
  segments: LossSegment[];
};

/** Số tuần để đi từ `from` xuống `to` với tốc độ `rate` mỗi tuần. */
function weeksBetween(from: number, to: number, rate: number): number {
  if (from <= to || to <= 0) return 0;
  return Math.log(to / from) / Math.log(1 - rate);
}

/**
 * Dựng bảng thời gian cho một khách. Trả về null khi thiếu dữ liệu để tính
 * (chưa có chiều cao hoặc cân nặng hiện tại).
 */
export function buildWeightTimeline(
  currentWeight: number,
  height: number,
  targetWeight: number
): WeightTimeline | null {
  if (!(height > 0) || !(currentWeight > 0)) return null;

  const standardWeight = height - 100;
  const idealWeight    = standardWeight * 0.9;

  // Chưa điền mục tiêu thì lấy tạm mốc đẹp làm đích, và nói rõ đó là gợi ý.
  const goalIsSuggested = !(targetWeight > 0);
  const goalWeight      = goalIsSuggested ? idealWeight : targetWeight;

  // Ranh giới của từng chặng, kẹp trong khoảng [đích, cân nặng hiện tại].
  const clamp = (w: number) => Math.min(Math.max(w, goalWeight), currentWeight);
  const fastTo   = clamp(standardWeight);
  const mediumTo = clamp(idealWeight);

  const defs: Array<{
    speed: LossSpeed;
    label: string;
    ratePct: string;
    rate: number;
    range: string;
    from: number;
    to: number;
  }> = [
    {
      speed: "fast",
      label: "Giảm cân nhanh",
      ratePct: "1%",
      rate: FAST_RATE,
      range: `Trên ${standardWeight.toFixed(1)} kg`,
      from: currentWeight,
      to: fastTo,
    },
    {
      speed: "medium",
      label: "Giảm cân vừa",
      ratePct: "0.75%",
      rate: MEDIUM_RATE,
      range: `${idealWeight.toFixed(1)} – ${standardWeight.toFixed(1)} kg`,
      from: fastTo,
      to: mediumTo,
    },
    {
      speed: "slow",
      label: "Giảm cân chậm",
      ratePct: "0.5%",
      rate: SLOW_RATE,
      range: `Dưới ${idealWeight.toFixed(1)} kg`,
      from: mediumTo,
      to: clamp(goalWeight),
    },
  ];

  const segments: LossSegment[] = defs.map((d) => {
    const weeks = weeksBetween(d.from, d.to, d.rate);
    return {
      speed: d.speed,
      label: d.label,
      ratePct: d.ratePct,
      rate: d.rate,
      range: d.range,
      fromWeight: d.from,
      toWeight: d.to,
      kg: Math.max(d.from - d.to, 0),
      weeks,
      // Làm tròn ngay ở từng chặng để ba cột cộng lại đúng bằng tổng hiện ra.
      days: Math.round(weeks * 7),
    };
  });

  return {
    currentWeight,
    goalWeight,
    goalIsSuggested,
    standardWeight,
    idealWeight,
    totalKg: Math.max(currentWeight - goalWeight, 0),
    totalDays: segments.reduce((s, x) => s + x.days, 0),
    totalWeeks: segments.reduce((s, x) => s + x.weeks, 0),
    segments,
  };
}

/**
 * Tốc độ giảm cân an toàn cho một khách ĐANG ở cân nặng `weight`.
 *
 * Đây là mặt "một thời điểm" của cùng quy tắc ở trên — dùng cho những chỗ chỉ
 * cần biết tuần này được phép giảm bao nhiêu %: mốc calo của thực đơn, ngưỡng
 * cảnh báo chậm tiến độ, bảng tốc độ từng gói.
 *
 * Thiếu chiều cao thì trả mức chậm nhất — thà đặt chỉ tiêu dè dặt còn hơn ép
 * khách theo một con số dựng trên số liệu không có.
 */
export function rateForWeight(weight: number, height: number): number {
  if (!(height > 0) || !(weight > 0)) return SLOW_RATE;
  const standardWeight = height - 100;
  if (weight > standardWeight) return FAST_RATE;
  if (weight > standardWeight * 0.9) return MEDIUM_RATE;
  return SLOW_RATE;
}

/**
 * Cân nặng dự kiến sau `weeks` tuần, không bao giờ xuống dưới `floorWeight`.
 *
 * Đi từng tuần một vì tốc độ đổi khi khách rơi qua mốc chuẩn / mốc đẹp giữa
 * chừng — tính một lần bằng tốc độ đầu kỳ sẽ ra nhanh hơn thực tế.
 */
export function projectWeight(
  startWeight: number,
  height: number,
  weeks: number,
  floorWeight = 0
): number {
  let w = startWeight;
  let left = weeks;
  while (left > 0) {
    const step = Math.min(left, 1);
    w -= w * rateForWeight(w, height) * step;
    if (w <= floorWeight) return floorWeight;
    left -= step;
  }
  return w;
}
