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

/**
 * MƯỜI SEPHIROT — nguồn sự thật duy nhất về cây, dùng chung cho cả cây vẽ
 * (components/dashboard/exam/kabbalah-tree.tsx), bảng chú giải, màn kết quả và
 * trang soạn đề của Admin. Đổi cách ghép tội thì sửa đúng ở đây một chỗ.
 *
 * BẢY Ô DƯỚI VỰC THẲM = BẢY ĐẠI TỘI, ghép theo MẶT TRÁI của từng sephirah —
 * mỗi phẩm chất khi mất cân bằng đổ về đúng cái tội của nó, nên vị trí trên cây
 * không phải gán bừa. Thí sinh KHÔNG phải thi cả bảy: chỉ tội nào có vòng trong
 * đề mới sáng, nên cây là bản đồ những gì người đó đã đối mặt, không phải một
 * thanh tiến độ.
 *
 * BA Ô TRÊN VỰC THẲM = BA ĐIỀU KIỆN THĂNG CẤP CÒN LẠI. Đậu lý thuyết chưa đưa
 * ai lên cấp: lib/pt-promotion.ts đòi đủ bốn điều kiện. Vực Thẳm chính là chỗ
 * bài thi không vượt qua hộ được ai.
 *
 * BA TRỤ đọc theo hướng lệch của bài làm (xem PILLAR_LABEL): trái Nghiêm khắc,
 * phải Khoan dung, giữa Cân bằng.
 */
export type SephirahInfo = {
  id: number;
  /** Tên Hebrew phiên âm — "Malkuth". */
  name: string;
  /** Nghĩa tiếng Việt — "Vương quốc". */
  vi: string;
  pillar: Pillar;
  /** Đại tội của ô này; null với ba ô trên Vực Thẳm. */
  sin: Sin | null;
  /** Nhãn ngắn vẽ cạnh ô trên cây — phải ngắn, không thì tràn khỏi khung. */
  short: string;
  /** Điều kiện thăng cấp ô này gánh — chỉ ba ô trên Vực Thẳm. */
  need?: string;
  /** Vì sao ghép như vậy. Một câu, hiện ở bảng chú giải. */
  why: string;
  aboveAbyss: boolean;
};

export const SEPHIROT: SephirahInfo[] = [
  {
    id: 1, name: "Kether", vi: "Vương miện", pillar: "BALANCE", sin: null,
    short: "Thăng cấp", need: "Đủ cả bốn điều kiện — thăng cấp",
    why: "Đỉnh cây, chỗ không ai trèo tới bằng riêng một bài thi. Sáng khi cả bốn điều kiện lên cấp cùng đạt.",
    aboveAbyss: true,
  },
  {
    id: 2, name: "Chokmah", vi: "Minh triết", pillar: "MERCY", sin: null,
    short: "Thực hành", need: "Bài kiểm tra thực hành",
    why: "Cái biết khi đã thể hiện ra ngoài — trên sàn tập, trước mặt người khác, không phải trên giấy.",
    aboveAbyss: true,
  },
  {
    id: 3, name: "Binah", vi: "Thấu hiểu", pillar: "SEVERITY", sin: null,
    short: "Doanh số", need: "Doanh số & khách transform",
    why: "Cái biết khi đã thành hình ở người khác: khách đổi được thân hình, và tiền về đúng chỉ tiêu.",
    aboveAbyss: true,
  },
  {
    id: 4, name: "Chesed", vi: "Từ ái", pillar: "MERCY", sin: "GREED",
    short: SIN_LABEL.GREED,
    why: "Rộng lượng khi quá đà thì thành vơ vét — bán thêm một gói nữa vì mình chứ không vì khách.",
    aboveAbyss: false,
  },
  {
    id: 5, name: "Geburah", vi: "Nghiêm cẩn", pillar: "SEVERITY", sin: "WRATH",
    short: SIN_LABEL.WRATH,
    why: "Sức mạnh và kỷ luật. Buông tay khỏi kỷ luật ấy một nhịp là thành cơn giận trước mặt khách.",
    aboveAbyss: false,
  },
  {
    id: 6, name: "Tiphareth", vi: "Vẻ đẹp", pillar: "BALANCE", sin: "PRIDE",
    short: SIN_LABEL.PRIDE,
    why: "Trung tâm hài hoà, và cũng là chỗ ngự của cái tôi: tự tin chuyên môn hoá thành không ai dạy được nữa.",
    aboveAbyss: false,
  },
  {
    id: 7, name: "Netzach", vi: "Bền bỉ", pillar: "MERCY", sin: "LUST",
    short: SIN_LABEL.LUST,
    why: "Khát khao và thôi thúc — thứ giữ người ta theo đuổi, và cũng là thứ đẩy người ta qua ranh giới nghề.",
    aboveAbyss: false,
  },
  {
    id: 8, name: "Hod", vi: "Uy nghi", pillar: "SEVERITY", sin: "ENVY",
    short: SIN_LABEL.ENVY,
    why: "Vinh quang và hình thức. Nhìn sang vinh quang của người bên cạnh chính là chỗ so bì sinh ra.",
    aboveAbyss: false,
  },
  {
    id: 9, name: "Yesod", vi: "Nền móng", pillar: "BALANCE", sin: "SLOTH",
    short: SIN_LABEL.SLOTH,
    why: "Nền của mọi thói quen. Móng lún thì khách bỏ tập — và trước đó là HLV thôi nhắn tin hỏi han.",
    aboveAbyss: false,
  },
  {
    id: 10, name: "Malkuth", vi: "Vương quốc", pillar: "BALANCE", sin: "GLUTTONY",
    short: SIN_LABEL.GLUTTONY,
    why: "Thế giới vật chất, thân xác, miếng ăn — chỗ mọi lý thuyết phải trở thành cụ thể.",
    aboveAbyss: false,
  },
];

export const SEPHIRAH_BY_ID: Record<number, SephirahInfo> = Object.fromEntries(
  SEPHIROT.map((s) => [s.id, s])
);

/** Tên đầy đủ hiện dưới cây — "Malkuth — Vương quốc". */
export function sephirahFullName(id: number): string {
  const s = SEPHIRAH_BY_ID[id];
  return s ? `${s.name} — ${s.vi}` : "";
}

/** Đại tội → sephirah của nó. Suy ra từ SEPHIROT, không khai báo lần hai. */
export const SIN_SEPHIRAH = Object.fromEntries(
  SEPHIROT.filter((s) => s.sin).map((s) => [s.sin as Sin, s.id])
) as Record<Sin, number>;

/** Sephirah → đại tội của nó (tra ngược). */
export const SEPHIRAH_SIN: Record<number, Sin | null> = Object.fromEntries(
  SEPHIROT.map((s) => [s.id, s.sin])
);

export const KETHER = 1;
export const CHOKMAH = 2;
export const BINAH = 3;

/** Ba ô trên Vực Thẳm — điều kiện thăng cấp mà bài thi không tự mở được. */
export const SUPERNAL_LABEL: Record<number, { name: string; need: string }> = Object.fromEntries(
  SEPHIROT.filter((s) => s.aboveAbyss).map((s) => [s.id, { name: `${s.name} — ${s.vi}`, need: s.need! }])
);

// ── Tội tự khai ──────────────────────────────────────────────────────────────
//
// Thí sinh khai một tội TRƯỚC KHI được xem đề. Không phải chọn thế mạnh mà là
// nhận mình yếu ở đâu — nên vòng của tội đã khai nặng hơn về mọi mặt:
//
//   • điểm nhân đôi           → nó chiếm phần lớn tổng điểm
//   • ngưỡng đạt vòng cao hơn → qua loa không qua được
//   • sai số hẹp lại (vòng khay ăn) → phải tính chính xác hơn
//   • BẮT BUỘC PHẢI QUA       → trượt vòng khai là trượt cả kỳ, không bù được
//
// Ba con số dưới đây là chỗ chỉnh độ gắt của cơ chế. Đặt tên hằng để sau này
// muốn nới hay siết thì sửa một chỗ, không phải đi dò trong công thức.

/**
 * SỐ VÒNG MỖI LƯỢT THI.
 *
 * Đề của cấp có đủ bảy đại tội nhưng không ai phải đi qua cả bảy trong một
 * buổi: mỗi lượt chỉ bốc bấy nhiêu vòng — vòng của tội đã khai, cộng phần còn
 * lại bốc ngẫu nhiên (xem pickTrialRounds trong lib/exam-trial-server.ts).
 *
 * Thay đổi con số này là thay đổi độ dài bài thi của mọi người, nên phải xem
 * lại thời lượng làm bài trong Lịch thi cùng lúc.
 */
export const TRIAL_ROUNDS_PER_ATTEMPT = 3;

/**
 * SỐ THẺ MỖI VÒNG PHÁT RA — và vì sao ngân hàng phải lớn hơn con số này.
 *
 * Mỗi đại tội có ngân hàng khoảng 50 thẻ, một lượt thi chỉ phát 13. Hai người
 * ngồi cạnh nhau nhận hai bộ khác nhau, kỳ sau lại khác nữa, nên chép đề gần
 * như vô dụng — cùng một lý do đã làm phần bốc đại tội ngẫu nhiên.
 *
 * Con số CỐ ĐỊNH cũng là điều kiện để thanh Thanh danh công bằng: thanh trừ
 * theo từng thẻ, nên vòng 13 thẻ gắt hơn vòng 12 thẻ. Mọi vòng cùng phát 13 thì
 * hết chuyện vòng này dễ hơn vòng kia chỉ vì người soạn viết ít thẻ hơn.
 */
export const TRIAL_CARDS_PER_ROUND = 13;

/**
 * Hình dạng bộ thẻ đã phát — bốc theo tầng, không bốc bừa 13 thẻ trong 50.
 *
 * Bốc bừa thì có lượt ra 9 thẻ "từ chối", có lượt ra 2 — hai bài thi khác hẳn
 * độ khó mà cùng một cái thang điểm. Chia theo vùng thì lượt nào cũng cùng hình
 * dạng, và vùng giữa vẫn chiếm phần lớn vì đó mới là chỗ phân loại được người.
 *
 * Tổng ba con số phải đúng bằng TRIAL_CARDS_PER_ROUND.
 */
export const TRIAL_CARD_MIX: Record<SortZone, number> = { ACCEPT: 3, CAUTION: 5, REFUSE: 5 };

/** Số hồ sơ khách phát ra ở vòng khay ăn — cùng lý do như thẻ. */
export const TRIAL_BRIEFS_PER_ROUND = 3;

export type MealKind = "CUT" | "BULK" | "SPECIAL";
export const MEAL_KINDS: MealKind[] = ["CUT", "BULK", "SPECIAL"];

/**
 * Hình dạng bộ hồ sơ đã phát — mỗi lượt đúng một khách mỗi dạng.
 *
 * Bốc bừa 3 trong 50 thì khoảng một phần ba số lượt sẽ ra cả ba khách đều muốn
 * giảm cân, và như thế là mất sạch cái bẫy vốn là linh hồn của vòng này: phản
 * xạ cắt calo cho bất kỳ ai bước vào phòng tập. Lượt nào cũng phải có một khách
 * cần TĂNG calo và một khách có ràng buộc bắt buộc.
 *
 * Tổng ba con số phải đúng bằng TRIAL_BRIEFS_PER_ROUND.
 */
export const TRIAL_BRIEF_MIX: Record<MealKind, number> = { CUT: 1, BULK: 1, SPECIAL: 1 };

export const MEAL_KIND_LABEL: Record<MealKind, string> = {
  CUT: "Giảm cân",
  BULK: "Tăng cân / xây cơ",
  SPECIAL: "Có ràng buộc bắt buộc",
};

/** Điểm tối đa của vòng đã khai được nhân bấy nhiêu lần. */
export const DECLARED_POINT_MULTIPLIER = 2;

/** Ngưỡng đạt của vòng đã khai cộng thêm bấy nhiêu %, trần 95%. */
export const DECLARED_PASS_BONUS = 15;
export const DECLARED_PASS_CAP = 95;

/** Sai số cho phép của vòng khay ăn đã khai co lại còn bấy nhiêu phần, sàn 3%. */
export const DECLARED_TOLERANCE_FACTOR = 0.6;
export const DECLARED_TOLERANCE_FLOOR = 3;

/** Thông số một vòng sau khi đã áp luật "tội tự khai". */
export function applyDeclaredSin<
  T extends { sin: string | null; maxPoints: number; passPercent: number }
>(round: T, declaredSin: Sin | null) {
  const declared = !!declaredSin && round.sin === declaredSin;
  if (!declared) {
    return { declared, maxPoints: round.maxPoints, passPercent: round.passPercent };
  }
  return {
    declared,
    maxPoints: round.maxPoints * DECLARED_POINT_MULTIPLIER,
    passPercent: Math.min(DECLARED_PASS_CAP, round.passPercent + DECLARED_PASS_BONUS),
  };
}

/** Sai số của một hồ sơ khay ăn sau khi áp luật tội tự khai. */
export function declaredTolerance(tolerancePercent: number, declared: boolean): number {
  if (!declared) return tolerancePercent;
  return Math.max(DECLARED_TOLERANCE_FLOOR, Math.round(tolerancePercent * DECLARED_TOLERANCE_FACTOR));
}

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

// ── Thanh Thanh danh — vòng lặp chơi của vòng phân loại thẻ ──────────────────
//
// Thẻ hiện từng thẻ một, bấm là KHOÁ, và hậu quả hiện ra ngay. Cái người ta
// nhìn thấy tụt đi là thanh Thanh danh: xếp đúng thì không mất gì, lệch một bậc
// mất ít, lệch hai bậc mất nhiều. Cạn thanh trước khi hết thẻ là trượt vòng
// ngay tại chỗ — không cần đợi tới lúc chấm mới biết.
//
// Vì sao khoá thẻ lại: có khoá thì mới dám báo kết quả ngay mà không hở đề.
// Sửa được đáp án mà lại thấy đúng/sai luôn thì bài thi thành trò mò mẫm.
//
// Ba con số dưới đây là chỗ chỉnh độ gắt. Với vòng 12 thẻ: lệch một bậc cả 12
// thẻ vẫn sống sót (96 < 100), nhưng BỐN lần lệch hai bậc là cạn.

export const HONOR_START = 100;
export const HONOR_COST_NEAR = 8;
export const HONOR_COST_FAR = 25;

/** Một thẻ ăn mất bao nhiêu Thanh danh, theo tỉ lệ điểm của thẻ đó. */
export function honorCost(ratio: number): number {
  if (ratio >= 1) return 0;
  return ratio > 0 ? HONOR_COST_NEAR : HONOR_COST_FAR;
}

/**
 * Thanh danh còn lại của một vòng, sàn 0.
 *
 * CHỈ tính thẻ ĐÃ TRẢ LỜI. Thẻ bỏ trống (hết giờ, thoát giữa chừng) không được
 * tính là lệch hai bậc — nếu tính thì con số lúc chấm sẽ khác hẳn con số thí
 * sinh nhìn thấy lúc làm bài, mà thanh này thì họ nhìn suốt cả vòng.
 */
export function honorAfter(results: { answer: SortZone | null; ratio: number }[]): number {
  let left = HONOR_START;
  for (const r of results) {
    if (!r.answer) continue;
    left = Math.max(0, left - honorCost(r.ratio));
  }
  return left;
}

/** Câu báo ngay sau khi bấm — nói mức lệch, KHÔNG nói đáp án đúng là gì. */
export const SORT_VERDICT: Record<number, { label: string; note: string }> = {
  0: { label: "Chính xác", note: "Giữ nguyên Thanh danh." },
  1: { label: "Lệch một bậc", note: "Gần đúng, nhưng chưa đúng vùng." },
  2: { label: "Lệch hai bậc", note: "Sai hẳn hướng xử lý." },
};

// ── Ghép điểm cả lượt thi ────────────────────────────────────────────────────

export type RoundScore = {
  roundId: string;
  points: number;
  maxPoints: number;
  passed: boolean;
  penalty: number;
  pillar: Pillar;
  /** Đây có phải vòng của tội thí sinh tự khai không. */
  declared: boolean;
};

/**
 * Điểm một vòng từ tỉ lệ đạt được của các phần trong vòng.
 * `ratios` là điểm 0–1 của từng thẻ / từng hồ sơ; vòng chia đều điểm cho chúng.
 */
export function scoreRound(
  round: { id: string; maxPoints: number; passPercent: number; failPenalty: number },
  ratios: number[],
  pillar: Pillar,
  /** Vòng của tội thí sinh tự khai — điểm và ngưỡng đạt đã được nâng trước khi vào đây. */
  declared = false,
  /** Cạn Thanh danh giữa vòng — trượt vòng bất kể điểm, xem honorAfter(). */
  collapsed = false,
): RoundScore {
  const avg = ratios.length === 0 ? 0 : ratios.reduce((s, r) => s + r, 0) / ratios.length;
  const points = Math.round(avg * round.maxPoints);
  const passed =
    !collapsed && round.maxPoints > 0 && (points / round.maxPoints) * 100 >= round.passPercent;
  return {
    roundId: round.id,
    points,
    maxPoints: round.maxPoints,
    passed,
    penalty: passed ? 0 : Math.max(0, round.failPenalty),
    pillar,
    declared,
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
  /** Trượt đúng vòng của tội mình đã khai — tự nó đánh rớt cả kỳ. */
  declaredFailed: boolean;
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

  // Trượt vòng đã tự khai là trượt cả kỳ, dù tổng điểm có đẹp tới đâu. Đó là
  // toàn bộ ý nghĩa của việc khai: dám nhận mình yếu ở đâu thì phải vượt qua
  // đúng chỗ đó, không bù bằng những vòng mình vốn đã giỏi.
  const declaredFailed = rounds.some((r) => r.declared && !r.passed);

  return {
    rounds,
    score,
    total,
    scorePct,
    passed: scorePct >= passingScore && !declaredFailed,
    declaredFailed,
    penalty,
    pillar,
  };
}

// ── Hành trình trên cây Kaballah ─────────────────────────────────────────────
//
// Bốn bậc trên TRỤ GIỮA (trụ Cân bằng), và mỗi bậc phải ĐỔI được bằng một việc
// thật, không phải bấm nút là lên:
//
//   0 · Malkuth   — Vương quốc  · chưa khai, còn đứng ở thế giới vật chất
//   1 · Yesod     — Nền móng    · đã dám khai tội. Thừa nhận mình yếu ở đâu là
//                                 nền móng; không có nó thì không xây được gì.
//   2 · Tiphareth — Vẻ đẹp      · đã VƯỢT QUA chính vòng của tội mình khai.
//                                 Nằm giữa cây, và cũng là trái tim của bài thi.
//   3 · Kether    — Vương miện  · đạt cả kỳ.
//
// Cái cây kể đúng câu chuyện mà điểm số đang kể: trượt vòng đã khai thì tổng
// điểm có đẹp tới đâu cũng dừng ở Yesod, y như luật chấm (scoreTrial). Không có
// trạng thái nào mâu thuẫn — đạt cả kỳ thì chắc chắn đã qua vòng khai, vì
// declaredFailed tự nó đánh rớt cả kỳ.

/** Bậc cao nhất đạt được trên trụ giữa sau một lượt thi. */
export function journeyStep(result: TrialScore): number {
  if (result.passed) return 3;
  const declaredRound = result.rounds.find((r) => r.declared);
  if (declaredRound?.passed) return 2;
  return 1;
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
