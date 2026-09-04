// ── Chấm đề thử thách nhiều vòng ─────────────────────────────────────────────
//
// Dùng CHUNG cho server (chấm thật, ghi ExamAttempt) và client (hiện điểm tạm
// trong lúc làm bài). Không có nhánh chấm điểm thứ hai ở đâu khác — đây là cổng
// thăng cấp, hai nơi tính lệch nhau một điểm là hỏng cả kỳ thi.
//
// Điểm một lượt thi:
//   tổng = Σ điểm từng vòng − Σ điểm phạt của các vòng bị trượt   (sàn 0)
//   đạt  = tổng / Σ điểm tối đa ≥ điểm đạt của cấp
//
// Trượt một vòng KHÔNG đánh rớt cả kỳ — nhưng bị trừ thẳng failPenalty vào
// tổng, nên trượt hai vòng thì gần như không gỡ lại được.
import { FOODS } from "./foods-data";

// ── Bảy đại tội ──────────────────────────────────────────────────────────────
//
// ĐẠI TỘI và LỐI CHƠI là hai thứ khác nhau. Đại tội là mảng năng lực được đo;
// lối chơi là cách đo (dựng khay ăn, phân loại thẻ…). Một tội có thể đo bằng
// lối chơi nào cũng được. Trộn hai thứ vào một danh sách là sinh ra chuyện
// dropdown chọn lối chơi lại hiện tên tội, và "Sa ngã" — không hề nằm trong
// bảy đại tội — lọt vào danh sách.

export type Sin = "PRIDE" | "GREED" | "LUST" | "ENVY" | "GLUTTONY" | "WRATH" | "SLOTH";

/** Đúng thứ tự kinh điển. Danh sách đóng — không thêm bớt. */
export const SINS: Sin[] = ["PRIDE", "GREED", "LUST", "ENVY", "GLUTTONY", "WRATH", "SLOTH"];

export const SIN_LABEL: Record<Sin, string> = {
  PRIDE: "Kiêu ngạo",
  GREED: "Tham lam",
  LUST: "Dục vọng",
  ENVY: "Ghen tị",
  GLUTTONY: "Phàm ăn",
  WRATH: "Phẫn nộ",
  SLOTH: "Lười biếng",
};

/** Mảng năng lực mà mỗi tội đo — hiện kèm tên tội để người soạn đề khỏi đoán. */
export const SIN_DOMAIN: Record<Sin, string> = {
  PRIDE: "Chuyên môn kỹ thuật, form động tác",
  GREED: "Doanh số & đạo đức bán gói",
  LUST: "Ranh giới nghề nghiệp",
  ENVY: "Sale",
  GLUTTONY: "Dinh dưỡng",
  WRATH: "Xử lý khiếu nại, xung đột",
  SLOTH: "Giữ khách, chống bỏ tập",
};

/** Lối chơi — mô tả CƠ CHẾ, tuyệt đối không kèm tên tội nào. */
export const ROUND_TYPE_LABEL: Record<"MEAL" | "SORT", string> = {
  MEAL: "Dựng khay ăn theo chỉ tiêu",
  SORT: "Phân loại tình huống vào 3 vùng",
};

export type SortZone = "ACCEPT" | "CAUTION" | "REFUSE";

/** Ba vùng xếp theo mức cứng rắn tăng dần — khoảng cách giữa chúng là điểm trừ. */
export const SORT_ZONES: SortZone[] = ["ACCEPT", "CAUTION", "REFUSE"];

export const SORT_ZONE_LABEL: Record<SortZone, string> = {
  ACCEPT: "Chấp nhận",
  CAUTION: "Cần cẩn trọng",
  REFUSE: "Từ chối & báo FM",
};

/**
 * Ba trụ của cây Kaballah, đọc theo hướng lệch của bài làm.
 *
 * KHÔNG phải "ở giữa luôn đúng": khách gian dối chế độ ăn thì Nghiêm khắc mới
 * đúng, khách vừa có chuyện gia đình thì Khoan dung mới đúng. Trụ ở đây chỉ ghi
 * lại người này NGHIÊNG về đâu khi họ sai — chân dung huấn luyện, không phải
 * điểm số. Điểm vẫn chấm theo đáp án đúng của từng tình huống.
 */
export type Pillar = "SEVERITY" | "MERCY" | "BALANCE";

export const PILLAR_LABEL: Record<Pillar, string> = {
  SEVERITY: "Nghiêm khắc",
  MERCY: "Khoan dung",
  BALANCE: "Cân bằng",
};

// ── Vòng Phàm ăn ─────────────────────────────────────────────────────────────

/** Một dòng trong khay ăn: món trong FOODS + khối lượng (gam). */
export type MealEntry = { food: string; grams: number };

export type MealBrief = {
  id: string;
  targetCalories: number | null;
  targetProtein: number | null;
  targetFat: number | null;
  targetCarbs: number | null;
  tolerancePercent: number;
  /** Tên món khách không được ăn — đã tách sẵn từ JSON.  */
  bannedFoods: string[];
};

export type MealTotals = { calories: number; protein: number; fat: number; carbs: number };

/** Trọng số 4 chỉ tiêu. Calo nặng nhất, đạm nhì — phòng tập giảm cân giữ cơ. */
const MEAL_WEIGHTS = { calories: 40, protein: 30, fat: 15, carbs: 15 } as const;
type MealMetric = keyof typeof MEAL_WEIGHTS;

const foodByName = new Map(FOODS.map((f) => [f.name, f]));

/** Tổng dinh dưỡng của một khay ăn. Món lạ (không có trong FOODS) bị bỏ qua. */
export function mealTotals(entries: MealEntry[]): MealTotals {
  const out: MealTotals = { calories: 0, protein: 0, fat: 0, carbs: 0 };
  for (const e of entries) {
    const f = foodByName.get(e.food);
    if (!f || !(e.grams > 0)) continue;
    const k = e.grams / 100; // bảng dinh dưỡng tính trên 100g
    out.calories += f.calories * k;
    out.protein += f.protein * k;
    out.fat += f.fat * k;
    out.carbs += f.carbs * k;
  }
  return {
    calories: Math.round(out.calories),
    protein: Math.round(out.protein),
    fat: Math.round(out.fat),
    carbs: Math.round(out.carbs),
  };
}

export type MealMetricResult = {
  metric: MealMetric;
  target: number;
  actual: number;
  /** Dải chấp nhận được quanh chỉ tiêu. */
  min: number;
  max: number;
  ok: boolean;
  weight: number;
};

export type MealBriefResult = {
  briefId: string;
  /** 0–1: phần điểm giành được của hồ sơ này. */
  ratio: number;
  totals: MealTotals;
  metrics: MealMetricResult[];
  /** Dùng món khách không được ăn → mất trắng hồ sơ này. */
  usedBanned: string[];
  /** Nghiêng về đâu khi sai: cho ăn quá tay là Khoan dung, ép kiêng quá là Nghiêm khắc. */
  pillar: Pillar;
};

/**
 * Chấm một hồ sơ của vòng Phàm ăn.
 *
 * Từng chỉ tiêu chấm nhị phân trong/ngoài dải — dễ giải thích cho người thi hơn
 * là một công thức khoảng cách, và cũng đúng thực tế: thực đơn lệch 30% calo
 * thì không "gần đúng", nó là sai.
 *
 * Chạm phải món cấm là 0 điểm cả hồ sơ. Dị ứng không phải chuyện thương lượng.
 */
export function gradeMealBrief(brief: MealBrief, entries: MealEntry[]): MealBriefResult {
  const totals = mealTotals(entries);

  const banned = new Set(brief.bannedFoods.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const usedBanned = entries
    .filter((e) => e.grams > 0 && banned.has(e.food.trim().toLowerCase()))
    .map((e) => e.food);

  const targets: Record<MealMetric, number | null> = {
    calories: brief.targetCalories,
    protein: brief.targetProtein,
    fat: brief.targetFat,
    carbs: brief.targetCarbs,
  };

  const tol = Math.max(0, brief.tolerancePercent) / 100;
  const metrics: MealMetricResult[] = [];
  let earned = 0;
  let available = 0;
  // Đếm hướng lệch để đọc ra trụ.
  let over = 0;
  let under = 0;

  for (const metric of Object.keys(MEAL_WEIGHTS) as MealMetric[]) {
    const target = targets[metric];
    if (target == null) continue; // chỉ tiêu bỏ trống = vòng không chấm
    const weight = MEAL_WEIGHTS[metric];
    const min = target * (1 - tol);
    const max = target * (1 + tol);
    const actual = totals[metric];
    const ok = actual >= min && actual <= max;
    available += weight;
    if (ok) earned += weight;
    else if (actual > max) over++;
    else under++;
    metrics.push({ metric, target, actual, min: Math.round(min), max: Math.round(max), ok, weight });
  }

  const pillar: Pillar = over === under ? "BALANCE" : over > under ? "MERCY" : "SEVERITY";
  // Không đặt chỉ tiêu nào thì không có gì để chấm — coi như trọn điểm, tránh
  // chia cho 0 và tránh phạt oan người thi vì đề soạn thiếu.
  const base = available === 0 ? 1 : earned / available;

  return {
    briefId: brief.id,
    ratio: usedBanned.length > 0 ? 0 : base,
    totals,
    metrics,
    usedBanned,
    pillar,
  };
}

// ── Vòng Sa ngã ──────────────────────────────────────────────────────────────

export type SortCard = { id: string; correctZone: SortZone };

export type SortCardResult = {
  cardId: string;
  answer: SortZone | null;
  correct: SortZone;
  /** 1 đúng hẳn · 0.5 lệch một bậc · 0 lệch hai bậc hoặc bỏ trống. */
  ratio: number;
  distance: number;
};

/**
 * Chấm một thẻ của vòng Sa ngã.
 *
 * Có điểm nửa vời cho lệch một bậc là cố ý: nhầm "cần cẩn trọng" thành "chấp
 * nhận" là non tay, còn "chấp nhận" thẳng một tình huống đáng phải từ chối và
 * báo FM là hỏng hẳn về nghề. Hai lỗi đó không thể tính như nhau.
 */
export function gradeSortCard(card: SortCard, answer: SortZone | null): SortCardResult {
  if (!answer) {
    return { cardId: card.id, answer: null, correct: card.correctZone, ratio: 0, distance: 2 };
  }
  const distance = Math.abs(SORT_ZONES.indexOf(answer) - SORT_ZONES.indexOf(card.correctZone));
  const ratio = distance === 0 ? 1 : distance === 1 ? 0.5 : 0;
  return { cardId: card.id, answer, correct: card.correctZone, ratio, distance };
}

/** Người này nghiêng về đâu khi phân loại sai: quá dễ dãi hay quá cứng rắn. */
export function sortPillar(results: SortCardResult[]): Pillar {
  let lenient = 0;
  let strict = 0;
  for (const r of results) {
    if (!r.answer || r.distance === 0) continue;
    const diff = SORT_ZONES.indexOf(r.answer) - SORT_ZONES.indexOf(r.correct);
    if (diff < 0) lenient++;
    else strict++;
  }
  return lenient === strict ? "BALANCE" : lenient > strict ? "MERCY" : "SEVERITY";
}

// ── Ghép điểm cả lượt thi ────────────────────────────────────────────────────

export type RoundScore = {
  roundId: string;
  points: number;
  maxPoints: number;
  passed: boolean;
  penalty: number;
  pillar: Pillar;
};

/**
 * Điểm một vòng từ tỉ lệ đạt được của các phần trong vòng.
 * `ratios` là điểm 0–1 của từng thẻ / từng hồ sơ; vòng chia đều điểm cho chúng.
 */
export function scoreRound(
  round: { id: string; maxPoints: number; passPercent: number; failPenalty: number },
  ratios: number[],
  pillar: Pillar,
): RoundScore {
  const avg = ratios.length === 0 ? 0 : ratios.reduce((s, r) => s + r, 0) / ratios.length;
  const points = Math.round(avg * round.maxPoints);
  const passed = round.maxPoints > 0 && (points / round.maxPoints) * 100 >= round.passPercent;
  return {
    roundId: round.id,
    points,
    maxPoints: round.maxPoints,
    passed,
    penalty: passed ? 0 : Math.max(0, round.failPenalty),
    pillar,
  };
}

export type TrialScore = {
  rounds: RoundScore[];
  /** Tổng điểm sau khi trừ phạt, không bao giờ âm. */
  score: number;
  total: number;
  scorePct: number;
  passed: boolean;
  /** Tổng điểm bị trừ vì trượt vòng. */
  penalty: number;
  /** Trụ nghiêng của cả lượt thi. */
  pillar: Pillar;
};

export function scoreTrial(rounds: RoundScore[], passingScore: number): TrialScore {
  const raw = rounds.reduce((s, r) => s + r.points, 0);
  const penalty = rounds.reduce((s, r) => s + r.penalty, 0);
  const total = rounds.reduce((s, r) => s + r.maxPoints, 0);
  const score = Math.max(0, raw - penalty);
  const scorePct = total > 0 ? Math.round((score / total) * 100) : 0;

  const lean = { SEVERITY: 0, MERCY: 0, BALANCE: 0 };
  for (const r of rounds) lean[r.pillar]++;
  const pillar: Pillar =
    lean.SEVERITY === lean.MERCY ? "BALANCE" : lean.SEVERITY > lean.MERCY ? "SEVERITY" : "MERCY";

  return { rounds, score, total, scorePct, passed: scorePct >= passingScore, penalty, pillar };
}

// ── Đọc bài làm dở từ ExamSession.trialState ─────────────────────────────────

/** { roundId: { briefId: MealEntry[] } | { cardId: SortZone } } */
export type TrialState = Record<string, Record<string, unknown>>;

export function parseTrialState(raw: unknown): TrialState {
  if (typeof raw !== "string" || !raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as TrialState;
  } catch {
    return {};
  }
}

/** Khay ăn của một hồ sơ, đã lọc bỏ dòng rác do client gửi lên. */
export function readMealEntries(state: TrialState, roundId: string, briefId: string): MealEntry[] {
  const raw = state[roundId]?.[briefId];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (e): e is MealEntry =>
        !!e && typeof e === "object" &&
        typeof (e as MealEntry).food === "string" &&
        typeof (e as MealEntry).grams === "number" &&
        (e as MealEntry).grams > 0
    )
    .map((e) => ({ food: e.food, grams: Math.min(5000, Math.round(e.grams)) }));
}

export function readSortAnswer(state: TrialState, roundId: string, cardId: string): SortZone | null {
  const raw = state[roundId]?.[cardId];
  return typeof raw === "string" && (SORT_ZONES as string[]).includes(raw) ? (raw as SortZone) : null;
}
