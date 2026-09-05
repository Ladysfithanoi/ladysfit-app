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
import { EXERCISE_BY_NAME } from "./exercises-data";

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
  SLOTH: "Thiết kế chương trình tập luyện",
};

/** Lối chơi — mô tả CƠ CHẾ, tuyệt đối không kèm tên tội nào. */
export const ROUND_TYPE_LABEL: Record<"MEAL" | "SORT" | "PROGRAM", string> = {
  MEAL: "Dựng khay ăn theo chỉ tiêu",
  SORT: "Phân loại tình huống vào 3 vùng",
  PROGRAM: "Dựng giáo án buổi tập theo chỉ tiêu",
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
    why: "Nền móng của mọi kết quả là giáo án. Móng dựng ẩu thì khách tập đủ buổi vẫn không đi tới đâu.",
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

/**
 * Nhóm hồ sơ khay ăn. CHỈ CÓ HAI: phòng tập không nhận khách mục tiêu tăng cân,
 * nên một hồ sơ "khách muốn lên 4kg" là tình huống không có thật ở đây và không
 * đo được gì. Từng có nhóm BULK, đã bỏ ngày 04/09/2026.
 */
export type MealKind = "CUT" | "SPECIAL";
export const MEAL_KINDS: MealKind[] = ["CUT", "SPECIAL"];

/**
 * Hình dạng bộ hồ sơ đã phát — hai khách giảm cân thường, một khách có ràng
 * buộc bắt buộc.
 *
 * Bốc bừa 3 trong 51 thì có lượt ra cả ba khách đều là ca giảm cân thẳng thớm,
 * và như thế là mất cái bẫy quan trọng nhất của vòng này: phản xạ cắt calo cho
 * bất kỳ ai bước vào phòng tập. Lượt nào cũng phải có một hồ sơ mà chỉ định y
 * tế hoặc ràng buộc ăn uống đứng trên nguyên tắc chung — khách mang thai, đang
 * cho con bú, suy thận, dị ứng, ăn chay.
 *
 * Tổng hai con số phải đúng bằng TRIAL_BRIEFS_PER_ROUND.
 */
export const TRIAL_BRIEF_MIX: Record<MealKind, number> = { CUT: 2, SPECIAL: 1 };

export const MEAL_KIND_LABEL: Record<MealKind, string> = {
  CUT: "Giảm cân",
  SPECIAL: "Có ràng buộc bắt buộc",
};

/**
 * CẤU HÌNH ĐỀ THỬ THÁCH của một cấp — bốn con số Admin chỉnh được ở Cài đặt →
 * Cấp độ, không phải sửa mã.
 *
 * Bỏ trống ô nào thì dùng số mặc định ở đây. Bốn hằng dưới là mặc định, KHÔNG
 * còn là luật cứng: luật cứng nằm ở cái Admin đặt cho từng cấp.
 */
export type TrialSetup = {
  /** Mỗi lượt thi bốc bao nhiêu đại tội. */
  roundsPerAttempt: number;
  /** Trong số đó bao nhiêu vòng là CASE STUDY; phần còn lại là vòng phân loại. */
  caseRounds: number;
  /** Số thẻ phát ra ở mỗi vòng phân loại. */
  cardsPerRound: number;
  /** Số hồ sơ phát ra ở mỗi vòng case study. */
  itemsPerCase: number;
  /**
   * Mốc trừ Thanh danh khi sai liên tiếp ở vòng phân loại. Mảng rỗng = tắt.
   * Xem phần "Trừ lũy tiến khi sai liên tiếp" ở cuối file.
   */
  streakTiers: StreakTier[];
};

export const TRIAL_SETUP_DEFAULT: TrialSetup = {
  roundsPerAttempt: TRIAL_ROUNDS_PER_ATTEMPT,
  caseRounds: 1,
  cardsPerRound: TRIAL_CARDS_PER_ROUND,
  itemsPerCase: TRIAL_BRIEFS_PER_ROUND,
  streakTiers: [],
};

/** Giới hạn cho ô nhập của Admin — đặt số vô lý thì bài thi vỡ chứ không báo gì. */
export const TRIAL_SETUP_LIMITS = {
  roundsPerAttempt: { min: 1, max: 7 },
  caseRounds: { min: 0, max: 7 },
  cardsPerRound: { min: 3, max: 50 },
  itemsPerCase: { min: 1, max: 10 },
} as const;

/**
 * Đọc cấu hình của một cấp, đã kẹp về khoảng hợp lệ.
 *
 * caseRounds không bao giờ vượt quá roundsPerAttempt: đặt "5 case study trong đề
 * 3 vòng" thì phần thừa bị bỏ, không làm vỡ lần bốc nào.
 */
export function trialSetupFor(level: {
  trialRoundsPerAttempt?: number | null;
  trialCaseRounds?: number | null;
  trialCardsPerRound?: number | null;
  trialItemsPerCase?: number | null;
  trialStreakTiers?: string | null;
} | null | undefined): TrialSetup {
  const clamp = (v: number | null | undefined, d: number, lo: number, hi: number) =>
    v == null || !Number.isFinite(v) ? d : Math.max(lo, Math.min(hi, Math.round(v)));

  const L = TRIAL_SETUP_LIMITS;
  const roundsPerAttempt = clamp(
    level?.trialRoundsPerAttempt, TRIAL_SETUP_DEFAULT.roundsPerAttempt,
    L.roundsPerAttempt.min, L.roundsPerAttempt.max
  );
  return {
    roundsPerAttempt,
    caseRounds: Math.min(
      roundsPerAttempt,
      clamp(level?.trialCaseRounds, TRIAL_SETUP_DEFAULT.caseRounds, L.caseRounds.min, L.caseRounds.max)
    ),
    cardsPerRound: clamp(
      level?.trialCardsPerRound, TRIAL_SETUP_DEFAULT.cardsPerRound,
      L.cardsPerRound.min, L.cardsPerRound.max
    ),
    itemsPerCase: clamp(
      level?.trialItemsPerCase, TRIAL_SETUP_DEFAULT.itemsPerCase,
      L.itemsPerCase.min, L.itemsPerCase.max
    ),
    streakTiers: parseStreakTiers(level?.trialStreakTiers),
  };
}

/** Vòng này là CASE STUDY hay vòng phân loại? */
export function isCaseRound(type: string): boolean {
  return type === "MEAL" || type === "PROGRAM";
}

// ── Hao Thanh danh của một thẻ ───────────────────────────────────────────────
//
// Ba con số gốc của vòng phân loại thẻ. Vòng lặp chơi mà chúng phục vụ nằm ở
// phần "Thanh Thanh danh" cuối file; đứng ở đây vì vòng đã khai đặt lại được
// hai trong ba, và cái đặt lại phải khai báo sau cái nó đặt lại.

export const HONOR_START = 100;
export const HONOR_COST_NEAR = 8;
export const HONOR_COST_FAR = 25;

/**
 * Một thẻ ăn mất bao nhiêu Thanh danh, theo tỉ lệ điểm của thẻ đó.
 * Vòng đã khai truyền vào mức riêng của nó; vòng thường dùng hai số gốc.
 */
export function honorCost(ratio: number, near = HONOR_COST_NEAR, far = HONOR_COST_FAR): number {
  if (ratio >= 1) return 0;
  return ratio > 0 ? near : far;
}

/** Điểm tối đa của vòng đã khai được nhân bấy nhiêu lần. */
export const DECLARED_POINT_MULTIPLIER = 2;

/** Mặc định: ngưỡng đạt của vòng đã khai cộng thêm bấy nhiêu %, trần 95%. */
export const DECLARED_PASS_BONUS = 15;
export const DECLARED_PASS_CAP = 95;

/** Sai số cho phép của vòng khay ăn đã khai co lại còn bấy nhiêu phần, sàn 3%. */
export const DECLARED_TOLERANCE_FACTOR = 0.6;
export const DECLARED_TOLERANCE_FLOOR = 3;

/**
 * ĐỘ GẮT RIÊNG CỦA VÒNG ĐÃ KHAI — năm con số Admin chỉnh ở Cài đặt → Cấp độ.
 *
 * Điểm ×2 và sai số co lại làm vòng khai khó hơn ở chỗ CHẤM. Năm con số dưới
 * đây làm nó khó hơn ở chỗ CHƠI và ở cửa ra: mỗi thẻ sai đắt hơn, chuỗi sai bị
 * phạt theo bảng riêng, và ngưỡng đạt của vòng do Admin định chứ không còn là
 * hằng số trong mã.
 *
 * Vì sao đáng tách riêng: cùng một chuỗi ba thẻ sai, ở vòng thường chỉ mất
 * điểm, còn ở vòng khai thì cạn thanh là trượt vòng — mà trượt vòng khai là
 * rớt cả kỳ. Chỗ đắt nhất của bài thi xứng đáng có thang riêng.
 */
export type DeclaredSetup = {
  /** Ngưỡng đạt của vòng khai cộng thêm bấy nhiêu %. */
  passBonus: number;
  /** Trần ngưỡng đạt của vòng khai — chặn cộng lên tới mức không ai qua nổi. */
  passCap: number;
  /** Hao Thanh danh khi lệch một bậc ở vòng khai. */
  costNear: number;
  /** Hao Thanh danh khi lệch hai bậc ở vòng khai. */
  costFar: number;
  /** Bảng mốc phạt liên tiếp riêng của vòng khai; RỖNG = dùng chung bảng của cấp. */
  streakTiers: StreakTier[];
};

export const DECLARED_SETUP_DEFAULT: DeclaredSetup = {
  passBonus: DECLARED_PASS_BONUS,
  passCap: DECLARED_PASS_CAP,
  costNear: HONOR_COST_NEAR,
  costFar: HONOR_COST_FAR,
  streakTiers: [],
};

export const DECLARED_SETUP_LIMITS = {
  passBonus: { min: 0, max: 50 },
  /** Sàn 50: đặt trần thấp hơn thế thì vòng khai dễ hơn vòng thường, vô nghĩa. */
  passCap: { min: 50, max: 100 },
  costNear: { min: 0, max: 100 },
  costFar: { min: 0, max: 100 },
} as const;

/** Cấu hình vòng khai của một cấp, đã kẹp về khoảng hợp lệ. */
export function declaredSetupFor(level: {
  trialDeclaredPassBonus?: number | null;
  trialDeclaredPassCap?: number | null;
  trialDeclaredCostNear?: number | null;
  trialDeclaredCostFar?: number | null;
  trialDeclaredStreakTiers?: string | null;
} | null | undefined): DeclaredSetup {
  const L = DECLARED_SETUP_LIMITS;
  const clamp = (v: number | null | undefined, d: number, lo: number, hi: number) =>
    v == null || !Number.isFinite(v) ? d : Math.max(lo, Math.min(hi, Math.round(v)));

  return {
    passBonus: clamp(level?.trialDeclaredPassBonus, DECLARED_SETUP_DEFAULT.passBonus, L.passBonus.min, L.passBonus.max),
    passCap: clamp(level?.trialDeclaredPassCap, DECLARED_SETUP_DEFAULT.passCap, L.passCap.min, L.passCap.max),
    costNear: clamp(level?.trialDeclaredCostNear, DECLARED_SETUP_DEFAULT.costNear, L.costNear.min, L.costNear.max),
    costFar: clamp(level?.trialDeclaredCostFar, DECLARED_SETUP_DEFAULT.costFar, L.costFar.min, L.costFar.max),
    streakTiers: parseStreakTiers(level?.trialDeclaredStreakTiers),
  };
}

/** Thông số một vòng sau khi đã áp luật "tội tự khai". */
export function applyDeclaredSin<
  T extends { sin: string | null; maxPoints: number; passPercent: number }
>(round: T, declaredSin: Sin | null, setup: DeclaredSetup = DECLARED_SETUP_DEFAULT) {
  const declared = !!declaredSin && round.sin === declaredSin;
  if (!declared) {
    return { declared, maxPoints: round.maxPoints, passPercent: round.passPercent };
  }
  return {
    declared,
    maxPoints: round.maxPoints * DECLARED_POINT_MULTIPLIER,
    passPercent: Math.min(setup.passCap, round.passPercent + setup.passBonus),
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
 * Ba trụ của cây Kabbalah, đọc theo hướng lệch của bài làm.
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

// ── Vòng Dựng giáo án ────────────────────────────────────────────────────────
//
// Case study về CHUYÊN MÔN: cho một hồ sơ khách kèm chống chỉ định, thí sinh tự
// dựng một buổi tập — chọn bài và chia số set.
//
// Cùng triết lý chấm với vòng khay ăn, vì cùng một loại việc: có chỉ tiêu, có
// sai số, có thứ tuyệt đối cấm. Khác ở chỗ khối lượng buổi tập không phải một
// con số mà là bốn: tổng set, và phần chia cho thân dưới / thân trên / core.
// Đúng tổng mà dồn hết vào chân thì vẫn là một buổi tập hỏng.
//
// BA THỨ KHIẾN NÓ KHÓ HƠN CHỌN MÓN ĂN:
//   • Bốn chỉ tiêu ràng buộc lẫn nhau — kéo nhóm này lên là nhóm kia lệch.
//   • Mẫu vận động bắt buộc: thiếu Hinge thì dù số set đẹp vẫn mất điểm, vì
//     một buổi chỉ toàn Squat là một buổi thiếu hẳn chuỗi sau cơ thể.
//   • Bài chống chỉ định: dùng một bài là hỏng cả hồ sơ, đúng như dị ứng bên
//     khay ăn. Chống chỉ định không phải chuyện thương lượng.

/** Một dòng trong giáo án: tên bài trong danh mục + số set. */
export type ProgramEntry = { exercise: string; sets: number };

export type ProgramCase = {
  id: string;
  targetTotalSets: number | null;
  targetLowerSets: number | null;
  targetUpperSets: number | null;
  targetCoreSets: number | null;
  tolerancePercent: number;
  /** Mẫu vận động buổi tập bắt buộc phải có — "Squat", "Hinge", "Push"… */
  requiredPatterns: string[];
  /** Bài chống chỉ định với khách này — dùng là hỏng cả hồ sơ. */
  bannedExercises: string[];
};

export type ProgramTotals = { total: number; lower: number; upper: number; core: number; cardio: number };

/** Trọng số 4 chỉ tiêu. Thân dưới nặng ngang tổng — phòng tập nữ, gốc là chân mông. */
const PROGRAM_WEIGHTS = { total: 30, lower: 30, upper: 25, core: 15 } as const;
type ProgramMetric = keyof typeof PROGRAM_WEIGHTS;

export type ProgramMetricResult = {
  metric: ProgramMetric;
  target: number;
  actual: number;
  min: number;
  max: number;
  ok: boolean;
  weight: number;
};

export type ProgramCaseResult = {
  caseId: string;
  ratio: number;
  totals: ProgramTotals;
  metrics: ProgramMetricResult[];
  /** Mẫu vận động bắt buộc mà giáo án còn thiếu. */
  missingPatterns: string[];
  usedBanned: string[];
  pillar: Pillar;
};

export const PROGRAM_METRIC_LABEL: Record<ProgramMetric, string> = {
  total: "Tổng set",
  lower: "Set thân dưới",
  upper: "Set thân trên",
  core: "Set core",
};

/** Cộng set theo nhóm. Bài lạ (không có trong danh mục) chỉ vào tổng. */
export function programTotals(entries: ProgramEntry[]): ProgramTotals {
  const t: ProgramTotals = { total: 0, lower: 0, upper: 0, core: 0, cardio: 0 };
  for (const e of entries) {
    const sets = Number(e.sets);
    if (!Number.isFinite(sets) || sets <= 0) continue;
    t.total += sets;
    const found = EXERCISE_BY_NAME.get(e.exercise);
    if (!found) continue;
    if (found.group === "LOWER") t.lower += sets;
    else if (found.group === "UPPER") t.upper += sets;
    else if (found.group === "CORE") t.core += sets;
    else if (found.group === "CARDIO") t.cardio += sets;
  }
  return t;
}

/** Những mẫu vận động giáo án đang có. */
export function programPatterns(entries: ProgramEntry[]): Set<string> {
  const out = new Set<string>();
  for (const e of entries) {
    if (!Number.isFinite(Number(e.sets)) || Number(e.sets) <= 0) continue;
    const found = EXERCISE_BY_NAME.get(e.exercise);
    if (found) out.add(found.pattern);
  }
  return out;
}

export function gradeProgramCase(c: ProgramCase, entries: ProgramEntry[]): ProgramCaseResult {
  const totals = programTotals(entries);

  const banned = new Set(c.bannedExercises.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const usedBanned = entries
    .filter((e) => Number(e.sets) > 0 && banned.has(e.exercise.trim().toLowerCase()))
    .map((e) => e.exercise);

  const targets: Record<ProgramMetric, number | null> = {
    total: c.targetTotalSets,
    lower: c.targetLowerSets,
    upper: c.targetUpperSets,
    core: c.targetCoreSets,
  };

  const tol = Math.max(0, c.tolerancePercent) / 100;
  const metrics: ProgramMetricResult[] = [];
  let earned = 0;
  let available = 0;
  let over = 0;
  let under = 0;

  for (const metric of Object.keys(PROGRAM_WEIGHTS) as ProgramMetric[]) {
    const target = targets[metric];
    if (target == null) continue; // chỉ tiêu bỏ trống = không chấm mục này
    const weight = PROGRAM_WEIGHTS[metric];
    // Set là số nguyên nhỏ, sai số phần trăm dễ ra khoảng rỗng — nới ít nhất 1 set.
    const span = Math.max(1, target * tol);
    const min = Math.ceil(target - span);
    const max = Math.floor(target + span);
    const actual = totals[metric];
    const ok = actual >= min && actual <= max;
    available += weight;
    if (ok) earned += weight;
    else if (actual > max) over++;
    else under++;
    metrics.push({ metric, target, actual, min, max, ok, weight });
  }

  const have = programPatterns(entries);
  const missingPatterns = c.requiredPatterns.filter((p) => p.trim() && !have.has(p.trim()));
  const patternFactor =
    c.requiredPatterns.length === 0
      ? 1
      : (c.requiredPatterns.length - missingPatterns.length) / c.requiredPatterns.length;

  // Nhồi quá chỉ tiêu = Nghiêm khắc, cho tập ít hơn cần = Khoan dung. Ngược chiều
  // với vòng khay ăn, vì ở đây "quá tay" nghĩa là bắt khách gánh nhiều hơn.
  const pillar: Pillar = over === under ? "BALANCE" : over > under ? "SEVERITY" : "MERCY";
  const base = available === 0 ? 1 : earned / available;

  return {
    caseId: c.id,
    ratio: usedBanned.length > 0 ? 0 : base * patternFactor,
    totals,
    metrics,
    missingPatterns,
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

// Ba con số gốc và honorCost() đã dời lên trên, ngay trước phần "Tội tự khai":
// vòng đã khai đặt lại được hai trong ba, mà cái đặt lại thì không thể khai báo
// trước cái nó đặt lại. Xem HONOR_START và DeclaredSetup.

// ── Trừ lũy tiến khi sai liên tiếp ───────────────────────────────────────────
//
// Hao Thanh danh ở trên phạt TỪNG thẻ rời rạc: sai thẻ nào trả giá thẻ đó, sai
// rải rác mười thẻ hay sai liền mười thẻ đều mất như nhau. Nhưng hai chuyện đó
// không giống nhau ngoài sàn tập — người sai liền một mạch là người đang mất
// phương hướng, không phải người lỡ tay một nhịp.
//
// MỘT MỐC = "sai liên tiếp bấy nhiêu thẻ thì trừ THÊM bấy nhiêu Thanh danh".
// Admin đặt bao nhiêu mốc tuỳ ý ở Cài đặt → Cấp độ; không đặt mốc nào thì cơ
// chế này tắt hẳn và vòng chạy đúng như trước.
//
// LUẬT ĐẾM, ba dòng, cố ý để đơn giản vì thí sinh phải nhẩm được trong đầu:
//   • Thẻ không ĐÚNG HẲN đều tính là sai — lệch một bậc cũng là sai. Nó đã trả
//     giá nhẹ hơn ở phần hao thường rồi, nhưng lệch một bậc bốn lần liền thì
//     vẫn là bốn lần liền không đọc đúng tình huống.
//   • Một thẻ đúng hẳn là chuỗi về 0. Gỡ được thì được tha, không mang nợ.
//   • Thẻ bỏ trống không tính, cũng không cắt chuỗi — cùng lý do honorAfter()
//     bỏ qua chúng.

/** Một mốc phạt: sai liên tiếp `streak` thẻ thì trừ thêm `penalty` Thanh danh. */
export type StreakTier = { streak: number; penalty: number };

/**
 * Khoảng hợp lệ của ô Admin nhập. Mốc bắt đầu từ 2 vì "sai liên tiếp 1 thẻ"
 * không phải một chuỗi — đó là hao thẻ thường, đã có honorCost() lo.
 */
export const STREAK_TIER_LIMITS = {
  streak: { min: 2, max: 50 },
  penalty: { min: 1, max: 100 },
  /** Nhiều mốc hơn số thẻ một vòng thì những mốc cuối không bao giờ chạm tới. */
  count: { min: 0, max: 10 },
} as const;

/** Không cấu hình gì = KHÔNG phạt liên tiếp. Bật lên là quyết định của Admin. */
export const STREAK_TIERS_DEFAULT: StreakTier[] = [];

/** Gợi ý điền sẵn ở trang cấu hình — chưa phải luật, Admin bấm Tạo mốc mới thành. */
export const STREAK_TIER_SUGGESTION = { firstStreak: 2, basePenalty: 10, step: 10, gap: 1, count: 3 };

/**
 * Bảng mốc đọc từ JSON đã lưu (hoặc từ mảng client gửi lên), đã dọn sạch.
 *
 * Dọn chứ không từ chối: bảng mốc hỏng mà ném lỗi thì cả vòng thi không chấm
 * được. Số vô lý bị kẹp về biên, mốc trùng số thẻ giữ mốc nặng hơn, và bảng
 * luôn ra theo thứ tự tăng dần — mọi chỗ dùng bên dưới đều trông vào điều đó.
 */
export function parseStreakTiers(raw: unknown): StreakTier[] {
  let list: unknown = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return [];
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];

  const L = STREAK_TIER_LIMITS;
  const bySteak = new Map<number, number>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const s = Number((item as StreakTier).streak);
    const p = Number((item as StreakTier).penalty);
    if (!Number.isFinite(s) || !Number.isFinite(p)) continue;
    const streak = Math.max(L.streak.min, Math.min(L.streak.max, Math.round(s)));
    const penalty = Math.max(L.penalty.min, Math.min(L.penalty.max, Math.round(p)));
    // Hai dòng cùng số thẻ thì giữ dòng phạt nặng hơn: Admin sửa dở dang không
    // được biến một mốc gắt thành mốc nhẹ sau lưng mình.
    bySteak.set(streak, Math.max(bySteak.get(streak) ?? 0, penalty));
  }

  return Array.from(bySteak.entries())
    .map(([streak, penalty]) => ({ streak, penalty }))
    .sort((a, b) => a.streak - b.streak)
    .slice(0, L.count.max);
}

/**
 * Dựng cả thang từ bốn con số: mốc nền, điểm trừ nền, bước lũy tiến, số đoạn.
 *
 * Chỉ là chỗ điền nhanh cho trang cấu hình — cái được lưu vẫn là bảng mốc, nên
 * Admin sửa tay một dòng bất kỳ sau khi tạo cũng không sao.
 */
export function buildStreakTiers(opts: {
  /** Chuỗi sai đầu tiên bị phạt. */
  firstStreak: number;
  /** Trừ bao nhiêu ở mốc nền. */
  basePenalty: number;
  /** Mỗi mốc sau trừ thêm bấy nhiêu so với mốc trước. */
  step: number;
  /** Cách bao nhiêu thẻ sai nữa thì lên mốc kế. */
  gap: number;
  /** Bao nhiêu đoạn. */
  count: number;
}): StreakTier[] {
  const L = STREAK_TIER_LIMITS;
  const count = Math.max(L.count.min, Math.min(L.count.max, Math.round(opts.count) || 0));
  const gap = Math.max(1, Math.round(opts.gap) || 1);
  const out: StreakTier[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      streak: Math.round(opts.firstStreak) + i * gap,
      penalty: Math.round(opts.basePenalty) + i * Math.round(opts.step),
    });
  }
  return parseStreakTiers(out);
}

/** Thẻ này có tính vào chuỗi sai không — đúng hẳn mới thoát. */
export function isStreakMiss(ratio: number): boolean {
  return ratio < 1;
}

/**
 * Chuỗi sai dài `streak` thẻ thì thẻ vừa rồi bị trừ thêm bao nhiêu.
 *
 * CHẠM MỐC MỚI TRỪ, mỗi mốc một lần trong một chuỗi: bảng "2 thẻ → 10, 4 thẻ →
 * 30" nghĩa là sai thẻ thứ 2 mất 10, thẻ thứ 3 không thêm gì, thẻ thứ 4 mất 30.
 * Qua mốc cuối rồi thì mỗi thẻ sai tiếp theo lặp lại mức của mốc cuối — không
 * thể có chuyện sai càng dài càng rẻ.
 */
export function streakPenaltyAt(streak: number, tiers: StreakTier[]): number {
  if (streak <= 0 || tiers.length === 0) return 0;
  const exact = tiers.find((t) => t.streak === streak);
  if (exact) return exact.penalty;
  const top = tiers[tiers.length - 1];
  return streak > top.streak ? top.penalty : 0;
}

/**
 * LUẬT TRỪ THANH DANH CỦA MỘT VÒNG — gói cả ba con số vào một chỗ.
 *
 * Gói lại vì vòng thường và vòng đã khai giờ có ba con số khác nhau, mà cả
 * client lẫn server đều phải chạy đúng bộ của vòng đang mở. Truyền rời từng số
 * thì sớm muộn có chỗ truyền hai số của vòng khai kèm bảng mốc của vòng thường.
 */
export type HonorRules = {
  costNear: number;
  costFar: number;
  tiers: StreakTier[];
};

export const HONOR_RULES_DEFAULT: HonorRules = {
  costNear: HONOR_COST_NEAR,
  costFar: HONOR_COST_FAR,
  tiers: [],
};

/**
 * Vòng này chạy luật nào: vòng thường dùng hai số gốc + bảng mốc của cấp; vòng
 * đã khai dùng bộ riêng của nó.
 *
 * Bảng mốc riêng ĐỂ TRỐNG nghĩa là vòng khai dùng chung bảng của cấp, KHÔNG
 * phải tắt phạt liên tiếp: bỏ trống một ô không bao giờ được làm bài thi dễ đi.
 */
export function honorRulesFor(opts: {
  /** Bảng mốc chung của cấp. */
  streakTiers: StreakTier[];
  declared: boolean;
  declaredSetup: DeclaredSetup;
}): HonorRules {
  if (!opts.declared) {
    return { costNear: HONOR_COST_NEAR, costFar: HONOR_COST_FAR, tiers: opts.streakTiers };
  }
  const d = opts.declaredSetup;
  return {
    costNear: d.costNear,
    costFar: d.costFar,
    tiers: d.streakTiers.length > 0 ? d.streakTiers : opts.streakTiers,
  };
}

/** Một thẻ trong mạch Thanh danh — đủ để vẽ lại đúng cái thí sinh đã thấy. */
export type HonorStep = {
  /** Thẻ chưa bấm: không hao gì, cũng không cắt chuỗi. */
  answered: boolean;
  ratio: number;
  /** Hao thường của thẻ (lệch một / hai bậc). */
  cost: number;
  /** Chuỗi sai liên tiếp tính tới thẻ này; 0 nếu thẻ này đúng hẳn. */
  streak: number;
  /** Trừ thêm vì chuỗi vừa chạm mốc. */
  streakPenalty: number;
  /** Thanh danh còn lại ngay sau thẻ này. */
  left: number;
};

/**
 * Chạy cả mạch Thanh danh của một vòng, trả về từng bước.
 *
 * Client dựng thanh trên màn hình bằng hàm này, server chấm cũng bằng hàm này —
 * một đường tính duy nhất, nên con số lúc chấm không thể khác con số thí sinh
 * đã nhìn thấy suốt cả vòng.
 */
export function honorRun(
  results: { answer: SortZone | null; ratio: number }[],
  rules: HonorRules = HONOR_RULES_DEFAULT,
): { steps: HonorStep[]; left: number } {
  let left = HONOR_START;
  let streak = 0;
  const steps: HonorStep[] = [];

  for (const r of results) {
    if (!r.answer) {
      steps.push({ answered: false, ratio: 0, cost: 0, streak: 0, streakPenalty: 0, left });
      continue;
    }
    const cost = honorCost(r.ratio, rules.costNear, rules.costFar);
    streak = isStreakMiss(r.ratio) ? streak + 1 : 0;
    const streakPenalty = streakPenaltyAt(streak, rules.tiers);
    left = Math.max(0, left - cost - streakPenalty);
    steps.push({ answered: true, ratio: r.ratio, cost, streak, streakPenalty, left });
  }

  return { steps, left };
}

/**
 * Thanh danh còn lại của một vòng, sàn 0.
 *
 * CHỈ tính thẻ ĐÃ TRẢ LỜI. Thẻ bỏ trống (hết giờ, thoát giữa chừng) không được
 * tính là lệch hai bậc — nếu tính thì con số lúc chấm sẽ khác hẳn con số thí
 * sinh nhìn thấy lúc làm bài, mà thanh này thì họ nhìn suốt cả vòng.
 */
export function honorAfter(
  results: { answer: SortZone | null; ratio: number }[],
  rules: HonorRules = HONOR_RULES_DEFAULT,
): number {
  return honorRun(results, rules).left;
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

// ── Hành trình trên cây Kabbalah ─────────────────────────────────────────────
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

/** Giáo án của một hồ sơ, đã lọc bỏ dòng rác do client gửi lên. */
export function readProgramEntries(state: TrialState, roundId: string, caseId: string): ProgramEntry[] {
  const raw = state[roundId]?.[caseId];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (e): e is ProgramEntry =>
        !!e && typeof e === "object" &&
        typeof (e as ProgramEntry).exercise === "string" &&
        typeof (e as ProgramEntry).sets === "number" &&
        (e as ProgramEntry).sets > 0
    )
    // Chặn trần 20 set/bài: gõ nhầm một số ba chữ số không được làm vỡ bảng điểm.
    .map((e) => ({ exercise: e.exercise, sets: Math.min(20, Math.round(e.sets)) }));
}

export function readSortAnswer(state: TrialState, roundId: string, cardId: string): SortZone | null {
  const raw = state[roundId]?.[cardId];
  return typeof raw === "string" && (SORT_ZONES as string[]).includes(raw) ? (raw as SortZone) : null;
}
