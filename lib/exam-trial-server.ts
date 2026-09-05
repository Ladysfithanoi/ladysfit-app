import { prisma } from "@/lib/prisma";
import { recordAttempt } from "@/lib/exam-grading";
import { examSettingsForLevel } from "@/lib/exam-level";
import { parseQuestionIds } from "@/lib/exam-session";
import {
  gradeMealBrief, gradeSortCard, scoreRound, scoreTrial, sortPillar,
  parseTrialState, readMealEntries, readSortAnswer, readProgramEntries,
  applyDeclaredSin, declaredTolerance, TRIAL_ROUNDS_PER_ATTEMPT, honorAfter,
  gradeProgramCase, type ProgramEntry,
  TRIAL_CARDS_PER_ROUND, TRIAL_BRIEFS_PER_ROUND, TRIAL_CARD_MIX, SORT_ZONES,
  TRIAL_BRIEF_MIX, MEAL_KINDS, type MealKind,
  type MealEntry, type Pillar, type RoundScore, type Sin, type SortZone, type TrialScore,
} from "@/lib/exam-trial";

/**
 * Phần đụng cơ sở dữ liệu của đề thử thách nhiều vòng.
 * Luật chấm nằm hết ở lib/exam-trial.ts (dùng chung với client); file này chỉ
 * nạp đề, gọi luật đó, rồi ghi kết quả.
 */

/** Món cấm lưu dạng JSON mảng — hỏng thì coi như không cấm gì, đừng làm sập bài thi. */
export function parseStringList(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Đề thử thách của một cấp, đã bỏ đáp án — an toàn để gửi xuống trang làm bài.
 *
 * Mỗi vòng chỉ gửi bộ thẻ / hồ sơ ĐÃ BỐC cho lượt này, không gửi cả ngân hàng:
 * ngân hàng 50 thẻ mà gửi hết thì mở F12 là đọc được 37 thẻ chưa hỏi tới.
 * pinnedItemIds có giá trị thì dùng lại đúng bộ cũ (F5 giữa chừng).
 */
export async function loadTrialForCandidate(levelId: string, pinnedItemIds: string[] | null = null) {
  const raw = await prisma.examRound.findMany({
    where: { levelId, isActive: true },
    orderBy: { order: "asc" },
    include: {
      mealBriefs: { orderBy: { order: "asc" } },
      sortCards: { orderBy: { order: "asc" } },
      programCases: { orderBy: { order: "asc" } },
    },
  });

  const rounds = raw.map((r) => ({
    ...r,
    mealBriefs: pickMealBriefs(r.mealBriefs, pinnedItemIds),
    sortCards: pickSortCards(r.sortCards, pinnedItemIds),
  }));

  return rounds.map((r) => ({
    id: r.id,
    type: r.type,
    sin: r.sin,
    name: r.name,
    intro: r.intro,
    maxPoints: r.maxPoints,
    passPercent: r.passPercent,
    failPenalty: r.failPenalty,
    briefs: r.mealBriefs.map((b) => ({
      id: b.id,
      clientProfile: b.clientProfile,
      targetCalories: b.targetCalories,
      targetProtein: b.targetProtein,
      targetFat: b.targetFat,
      targetCarbs: b.targetCarbs,
      tolerancePercent: b.tolerancePercent,
      bannedFoods: parseStringList(b.bannedFoods),
      // explanation KHÔNG gửi đi — đó là lời giải, chỉ hiện sau khi chấm.
    })),
    // correctZone KHÔNG gửi đi, nếu không mở F12 là thấy hết đáp án.
    cards: r.sortCards.map((c) => ({ id: c.id, text: c.text })),
    cases: r.programCases.map((pc) => ({
      id: pc.id,
      clientProfile: pc.clientProfile,
      targetTotalSets: pc.targetTotalSets,
      targetLowerSets: pc.targetLowerSets,
      targetUpperSets: pc.targetUpperSets,
      targetCoreSets: pc.targetCoreSets,
      tolerancePercent: pc.tolerancePercent,
      // Mẫu bắt buộc và bài chống chỉ định PHẢI gửi đi — đó là ĐỀ BÀI, không
      // phải đáp án. Giấu đi thì hồ sơ thành đoán mò, mà ngoài đời hồ sơ khách
      // nào cũng ghi rõ chống chỉ định.
      requiredPatterns: parseStringList(pc.requiredPatterns),
      bannedExercises: parseStringList(pc.bannedExercises),
      // explanation KHÔNG gửi đi — đó là lời giải, chỉ hiện sau khi chấm.
    })),
  }));
}

export type TrialRoundForCandidate = Awaited<ReturnType<typeof loadTrialForCandidate>>[number];

/** Cấp này đã có vòng nào chưa — chưa có thì không mở đề được. */
export async function trialRoundCount(levelId: string): Promise<number> {
  return prisma.examRound.count({ where: { levelId, isActive: true } });
}

export type TrialGradeOutcome =
  | { ok: false; error: string }
  | { ok: true; attemptId: string; result: TrialScore; promoted: boolean };

/**
 * Chấm cả lượt thi thử thách và ghi kết quả.
 *
 * Đề được nạp lại TỪ SERVER chứ không tin bản client gửi lên: client chỉ gửi
 * bài làm (khay ăn, thẻ đã phân), còn chỉ tiêu và đáp án đúng luôn lấy từ cơ sở
 * dữ liệu. Sửa gói tin gửi lên không tự nâng điểm được.
 */
/** Bài soi lại của một vòng — chỉ dùng cho THI THỬ, không bao giờ gửi cho thí sinh thật. */
export type TrialReviewRound = {
  id: string;
  name: string;
  sin: string | null;
  type: "MEAL" | "SORT" | "PROGRAM";
  points: number;
  maxPoints: number;
  passed: boolean;
  penalty: number;
  briefs: {
    id: string;
    clientProfile: string;
    ratio: number;
    totals: { calories: number; protein: number; fat: number; carbs: number };
    metrics: { metric: string; target: number; actual: number; min: number; max: number; ok: boolean }[];
    usedBanned: string[];
    explanation: string | null;
  }[];
  cases: {
    id: string;
    clientProfile: string;
    ratio: number;
    totals: { total: number; lower: number; upper: number; core: number; cardio: number };
    metrics: { metric: string; target: number; actual: number; min: number; max: number; ok: boolean }[];
    missingPatterns: string[];
    usedBanned: string[];
    explanation: string | null;
  }[];
  cards: {
    id: string;
    text: string;
    answer: SortZone | null;
    correct: SortZone;
    ratio: number;
    explanation: string | null;
  }[];
};

type ComputedTrial = {
  roundScores: RoundScore[];
  details: { roundId: string; detail: string; pillar: Pillar }[];
  result: TrialScore;
  review: TrialReviewRound[];
};

/**
 * TÍNH ĐIỂM một bài làm, không ghi gì cả.
 *
 * Tách khỏi phần ghi kết quả để thi thật và thi thử dùng CHUNG đúng một bộ luật.
 * Có hai đường tính điểm là sớm muộn hai đường ra hai kết quả khác nhau, và lúc
 * đó Admin kiểm đề bằng thi thử sẽ không còn kiểm được gì.
 *
 * Đề luôn nạp lại TỪ SERVER: client chỉ gửi bài làm, chỉ tiêu và đáp án đúng
 * lấy từ cơ sở dữ liệu, nên sửa gói tin gửi lên không tự nâng điểm được.
 */
export async function computeTrial(
  levelId: string,
  rawState: unknown,
  passingScore: number,
  /** Tội thí sinh tự khai — vòng của tội đó khó hơn và bắt buộc phải qua. */
  declaredSin: Sin | null = null,
  /**
   * Đúng những vòng đã bốc cho lượt thi này (questionIds của ExamSession).
   *
   * BẮT BUỘC phải truyền với bài thi thật. Một lượt chỉ được phát vài vòng
   * trong bảy vòng của đề; chấm cả bảy thì những vòng thí sinh chưa từng nhìn
   * thấy đều thành 0 điểm và không ai đậu nổi.
   *
   * Để trống thì chấm mọi vòng đang bật — lối cũ, giữ lại cho những lượt thi
   * mở trước khi có cơ chế bốc vòng.
   */
  roundIds: string[] | null = null,
  /**
   * Đúng những THẺ / HỒ SƠ đã phát cho lượt này (trialItemIds của ExamSession),
   * theo đúng thứ tự đã trình bày.
   *
   * Thiếu nó thì chấm cả ngân hàng 50 thẻ: 37 thẻ chưa từng hỏi tới đều thành
   * bỏ trống, tức 0 điểm. Thứ tự cũng phải giữ, vì thanh Thanh danh trừ theo
   * từng thẻ nên thẻ nào làm cạn thanh là phụ thuộc thứ tự.
   *
   * Để trống thì lấy cả vòng — lối cũ, cho những lượt mở trước khi có ngân hàng.
   */
  itemIds: string[] | null = null
): Promise<{ ok: false; error: string } | ({ ok: true; state: TrialStateShape } & ComputedTrial)> {
  const state = parseTrialState(typeof rawState === "string" ? rawState : JSON.stringify(rawState));

  const raw = await prisma.examRound.findMany({
    where: {
      levelId,
      isActive: true,
      ...(roundIds && roundIds.length > 0 ? { id: { in: roundIds } } : {}),
    },
    orderBy: { order: "asc" },
    include: {
      mealBriefs: { orderBy: { order: "asc" } },
      sortCards: { orderBy: { order: "asc" } },
      programCases: { orderBy: { order: "asc" } },
    },
  });
  const served = itemIds && itemIds.length > 0 ? itemIds : null;
  const rounds = raw.map((r) => ({
    ...r,
    mealBriefs: served ? pickMealBriefs(r.mealBriefs, served, r.mealBriefs.length) : r.mealBriefs,
    sortCards: served ? pickSortCards(r.sortCards, served, r.sortCards.length) : r.sortCards,
    programCases: served ? pickProgramCases(r.programCases, served, r.programCases.length) : r.programCases,
  }));
  if (rounds.length === 0) return { ok: false, error: "Đề của cấp này chưa có vòng nào" };

  const roundScores: RoundScore[] = [];
  const details: { roundId: string; detail: string; pillar: Pillar }[] = [];
  const review: TrialReviewRound[] = [];

  for (const round of rounds) {
    // Vòng của tội đã khai: điểm nhân đôi, ngưỡng đạt cao hơn, sai số hẹp lại.
    const tuned = applyDeclaredSin(round, declaredSin);
    const scored = { ...round, maxPoints: tuned.maxPoints, passPercent: tuned.passPercent };

    if (round.type === "MEAL") {
      const results = round.mealBriefs.map((b) => {
        const entries: MealEntry[] = readMealEntries(state, round.id, b.id);
        return gradeMealBrief(
          {
            id: b.id,
            targetCalories: b.targetCalories,
            targetProtein: b.targetProtein,
            targetFat: b.targetFat,
            targetCarbs: b.targetCarbs,
            tolerancePercent: declaredTolerance(b.tolerancePercent, tuned.declared),
            bannedFoods: parseStringList(b.bannedFoods),
          },
          entries
        );
      });
      // Trụ của vòng = hướng lệch chiếm đa số trong các hồ sơ.
      const lean = { SEVERITY: 0, MERCY: 0, BALANCE: 0 };
      for (const r of results) lean[r.pillar]++;
      const pillar: Pillar =
        lean.SEVERITY === lean.MERCY ? "BALANCE" : lean.SEVERITY > lean.MERCY ? "SEVERITY" : "MERCY";

      const rs = scoreRound(scored, results.map((r) => r.ratio), pillar, tuned.declared);
      roundScores.push(rs);
      details.push({ roundId: round.id, detail: JSON.stringify(results), pillar });
      review.push({
        ...roundHead(round, rs),
        briefs: results.map((r, i) => ({
          id: r.briefId,
          clientProfile: round.mealBriefs[i].clientProfile,
          ratio: r.ratio,
          totals: r.totals,
          metrics: r.metrics.map((m) => ({
            metric: m.metric, target: m.target, actual: m.actual, min: m.min, max: m.max, ok: m.ok,
          })),
          usedBanned: r.usedBanned,
          explanation: round.mealBriefs[i].explanation,
        })),
        cards: [],
        cases: [],
      });
    } else if (round.type === "PROGRAM") {
      const results = round.programCases.map((pc) => {
        const entries: ProgramEntry[] = readProgramEntries(state, round.id, pc.id);
        return gradeProgramCase(
          {
            id: pc.id,
            targetTotalSets: pc.targetTotalSets,
            targetLowerSets: pc.targetLowerSets,
            targetUpperSets: pc.targetUpperSets,
            targetCoreSets: pc.targetCoreSets,
            tolerancePercent: pc.tolerancePercent,
            requiredPatterns: parseStringList(pc.requiredPatterns),
            bannedExercises: parseStringList(pc.bannedExercises),
          },
          entries
        );
      });
      // Trụ của vòng = hướng lệch chiếm đa số trong các hồ sơ.
      const lean = { SEVERITY: 0, MERCY: 0, BALANCE: 0 };
      for (const r of results) lean[r.pillar]++;
      const pillar: Pillar =
        lean.SEVERITY === lean.MERCY ? "BALANCE" : lean.SEVERITY > lean.MERCY ? "SEVERITY" : "MERCY";

      const rs = scoreRound(scored, results.map((r) => r.ratio), pillar, tuned.declared);
      roundScores.push(rs);
      details.push({ roundId: round.id, detail: JSON.stringify(results), pillar });
      review.push({
        ...roundHead(round, rs),
        briefs: [],
        cards: [],
        cases: results.map((r, i) => ({
          id: r.caseId,
          clientProfile: round.programCases[i].clientProfile,
          ratio: r.ratio,
          totals: r.totals,
          metrics: r.metrics.map((m) => ({
            metric: m.metric, target: m.target, actual: m.actual, min: m.min, max: m.max, ok: m.ok,
          })),
          missingPatterns: r.missingPatterns,
          usedBanned: r.usedBanned,
          explanation: round.programCases[i].explanation,
        })),
      });
    } else {
      const results = round.sortCards.map((c) => {
        const answer: SortZone | null = readSortAnswer(state, round.id, c.id);
        return gradeSortCard({ id: c.id, correctZone: c.correctZone }, answer);
      });
      const pillar = sortPillar(results);
      // Cạn Thanh danh giữa vòng là trượt vòng, dù mấy thẻ còn lại có đúng hết.
      // Chấm bằng đúng hàm mà thanh trên màn hình đang chạy, nên con số lúc chấm
      // không thể khác con số thí sinh đã nhìn thấy.
      const collapsed = honorAfter(results) <= 0;
      const rs = scoreRound(scored, results.map((r) => r.ratio), pillar, tuned.declared, collapsed);
      roundScores.push(rs);
      details.push({ roundId: round.id, detail: JSON.stringify(results), pillar });
      review.push({
        ...roundHead(round, rs),
        briefs: [],
        cards: results.map((r, i) => ({
          id: r.cardId,
          text: round.sortCards[i].text,
          answer: r.answer,
          correct: r.correct,
          ratio: r.ratio,
          explanation: round.sortCards[i].explanation,
        })),
        cases: [],
      });
    }
  }

  return {
    ok: true,
    state,
    roundScores,
    details,
    review,
    result: scoreTrial(roundScores, passingScore),
  };
}

type TrialStateShape = ReturnType<typeof parseTrialState>;

function roundHead(
  round: { id: string; name: string; sin: string | null; type: "MEAL" | "SORT" | "PROGRAM" },
  rs: RoundScore
) {
  return {
    id: round.id,
    name: round.name,
    sin: round.sin,
    type: round.type,
    points: rs.points,
    maxPoints: rs.maxPoints,
    passed: rs.passed,
    penalty: rs.penalty,
  };
}

export async function gradeTrialAttempt(opts: {
  userId: string;
  userName: string;
  levelId: string;
  passingScore: number;
  violations: number;
  noPenalty: boolean;
  /** Bài làm: { roundId: { briefId: MealEntry[] | cardId: SortZone } } */
  state: unknown;
  declaredSin?: Sin | null;
  /** Vòng đã bốc cho lượt thi này — xem computeTrial. */
  roundIds?: string[] | null;
  /** Thẻ / hồ sơ đã phát cho lượt thi này, đúng thứ tự — xem computeTrial. */
  itemIds?: string[] | null;
}): Promise<TrialGradeOutcome> {
  const computed = await computeTrial(
    opts.levelId,
    opts.state,
    opts.passingScore,
    opts.declaredSin ?? null,
    opts.roundIds ?? null,
    opts.itemIds ?? null
  );
  if (!computed.ok) return computed;
  const { state, roundScores, details, result } = computed;

  const recorded = await recordAttempt({
    userId: opts.userId,
    userName: opts.userName,
    score: result.score,
    total: result.total,
    passingScore: opts.passingScore,
    violations: opts.violations,
    noPenalty: opts.noPenalty,
    levelId: opts.levelId,
    answersJson: JSON.stringify(state),
    declaredSin: opts.declaredSin ?? null,
  });
  if (!recorded.ok) return { ok: false, error: recorded.error };

  await prisma.examRoundResult.createMany({
    data: roundScores.map((rs, i) => ({
      attemptId: recorded.attemptId,
      roundId: rs.roundId,
      points: rs.points,
      maxPoints: rs.maxPoints,
      passed: rs.passed,
      penalty: rs.penalty,
      detail: details[i].detail,
      pillar: details[i].pillar,
    })),
  });

  return { ok: true, attemptId: recorded.attemptId, result, promoted: recorded.promoted };
}

/**
 * Chấm một lượt thi ĐỀ NHIỀU VÒNG đã hết giờ mà không ai nộp, từ bài đã tự lưu.
 *
 * Song song với gradePendingSession() của đề trắc nghiệm và cùng một mục đích:
 * mất mạng, sập trình duyệt hay hết pin thì phần người ta đã làm vẫn nằm ở
 * server, không có lý do gì để họ mất trắng. Khác đúng một chỗ — bài dở của đề
 * nhiều vòng nằm ở trialState chứ không phải answers, nên nút "Chấm bài đã lưu"
 * của Admin phải đi cả hai đường mới thu đủ.
 *
 * Giành lượt bằng update có điều kiện submittedAt = null nên gọi song song từ
 * hai chỗ cũng chỉ một bên chấm được.
 */
export async function gradePendingTrialSession(
  sessionId: string,
  fallbackPassingScore: number
): Promise<TrialGradeOutcome> {
  const examSession = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: { user: { select: { name: true, email: true, role: true } } },
  });

  if (!examSession) return { ok: false, error: "Không tìm thấy lượt thi" };
  if (examSession.submittedAt) return { ok: false, error: "Lượt thi này đã nộp bài rồi" };
  if (!examSession.levelId) return { ok: false, error: "Lượt thi này không gắn với cấp nào" };

  const state = parseTrialState(examSession.trialState);
  if (Object.keys(state).length === 0) {
    return { ok: false, error: "Lượt thi này không có bài làm nào được lưu" };
  }

  const claimed = await prisma.examSession.updateMany({
    where: { id: examSession.id, submittedAt: null },
    data: { submittedAt: new Date() },
  });
  if (claimed.count === 0) return { ok: false, error: "Lượt thi này đã nộp bài rồi" };

  // Điểm đạt theo cấp đã chốt lúc mở đề, không phải cấp hiện tại của người thi.
  const settings = await examSettingsForLevel(examSession.levelId, {
    passingScore: fallbackPassingScore,
  });

  const result = await gradeTrialAttempt({
    userId: examSession.userId,
    userName: examSession.user.name ?? examSession.user.email ?? "PT",
    levelId: examSession.levelId,
    passingScore: settings.passingScore,
    violations: examSession.violations,
    noPenalty: examSession.user.role === "FM",
    state: examSession.trialState,
    declaredSin: examSession.declaredSin,
    roundIds: parseQuestionIds(examSession.questionIds),
    itemIds: parseQuestionIds(examSession.trialItemIds),
  });

  if (!result.ok) {
    // Chấm không thành thì trả lượt về chưa nộp để còn thử lại.
    await prisma.examSession.update({
      where: { id: examSession.id },
      data: { submittedAt: null },
    });
    return result;
  }

  await prisma.examSession.update({
    where: { id: examSession.id },
    data: { attemptId: result.attemptId },
  });
  return result;
}

/**
 * Vòng thi gửi cho màn SOẠN ĐỀ (kèm đáp án, khác loadTrialForCandidate).
 *
 * bannedFoods trong cơ sở dữ liệu là một chuỗi JSON, nhưng cả màn soạn đề lẫn
 * đường ghi lại đều làm việc với MẢNG. Trả thẳng chuỗi ra ngoài là màn soạn đề
 * gọi .join() trên một chuỗi rồi ném lỗi, sập cả trang — đúng một lần đã xảy ra.
 */
export function serializeRoundForAdmin<
  T extends {
    mealBriefs: { bannedFoods: string | null }[];
    programCases: { requiredPatterns: string | null; bannedExercises: string | null }[];
  }
>(round: T) {
  return {
    ...round,
    mealBriefs: round.mealBriefs.map((b) => ({
      ...b,
      bannedFoods: parseStringList(b.bannedFoods),
    })),
    programCases: round.programCases.map((pc) => ({
      ...pc,
      requiredPatterns: parseStringList(pc.requiredPatterns),
      bannedExercises: parseStringList(pc.bannedExercises),
    })),
  };
}

/**
 * Mức lệch của những thẻ ĐÃ trả lời — { cardId: ratio }.
 *
 * Cần cho lúc tải lại trang giữa vòng: bài làm thì lấy từ trialState, nhưng
 * thanh Thanh danh và mấy dòng "lệch một bậc" thì dựng lại từ đâu? Không có
 * bảng này thì F5 xong thanh về đầy 100 — vừa sai, vừa là một cách xoá dấu vết
 * đã bấm sai.
 *
 * Chỉ trả về THẺ ĐÃ TRẢ LỜI và chỉ trả về mức lệch, không kèm đáp án đúng. Thẻ
 * đã khoá rồi nên biết mình lệch bao nhiêu cũng không giúp gì cho thẻ còn lại.
 */
export async function sortCardOutcomes(
  roundIds: string[],
  rawState: string | null
): Promise<Record<string, number>> {
  if (roundIds.length === 0) return {};
  const state = parseTrialState(rawState);
  if (Object.keys(state).length === 0) return {};

  const cards = await prisma.examSortCard.findMany({
    where: { roundId: { in: roundIds } },
    select: { id: true, roundId: true, correctZone: true },
  });

  const out: Record<string, number> = {};
  for (const c of cards) {
    const answer = readSortAnswer(state, c.roundId, c.id);
    if (!answer) continue;
    out[c.id] = gradeSortCard({ id: c.id, correctZone: c.correctZone }, answer).ratio;
  }
  return out;
}


/**
 * BỐC THẺ / HỒ SƠ CHO MỘT VÒNG — cùng nguyên tắc với pickTrialRounds.
 *
 * Ngân hàng của mỗi vòng lớn hơn nhiều số thẻ phát ra (khoảng 50 thẻ, phát 13).
 * Bộ đã bốc CHỐT vào ExamSession.trialItemIds ngay lần mở đề đầu tiên, nên F5
 * không bốc lại được và lúc chấm chấm đúng những thẻ đã cho người ta thấy.
 *
 * THỨ TỰ TRẢ VỀ CHÍNH LÀ THỨ TỰ TRÌNH BÀY, và nó phải xáo. Ngân hàng thường
 * viết theo cụm — chấp nhận trước, từ chối sau — nên giữ nguyên thứ tự gốc là
 * tự khai ra đáp án ngay từ cách sắp xếp. Thứ tự cũng quyết định thẻ nào làm
 * cạn Thanh danh, nên nó phải được ghi lại y hệt để lúc chấm ra đúng một kết
 * quả với lúc làm bài.
 */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Sắp lại theo đúng thứ tự đã chốt; id lạ trong danh sách chốt thì bỏ qua. */
function byPinnedOrder<T extends { id: string }>(items: T[], pinned: string[]): T[] {
  const rank = new Map(pinned.map((id, i) => [id, i]));
  return items.filter((x) => rank.has(x.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
}

/**
 * Bốc thẻ theo TẦNG VÙNG (xem TRIAL_CARD_MIX), rồi xáo thứ tự trình bày.
 *
 * Vùng nào ngân hàng chưa đủ thì lấy hết vùng đó và bù bằng thẻ còn lại — đề
 * đang soạn dở vẫn thi thử được, chỉ là bộ thẻ chưa cân.
 */
export function pickSortCards<T extends { id: string; correctZone: SortZone }>(
  cards: T[],
  pinned: string[] | null,
  limit: number = TRIAL_CARDS_PER_ROUND
): T[] {
  if (pinned && pinned.length > 0) {
    const kept = byPinnedOrder(cards, pinned);
    if (kept.length > 0) return kept;
  }

  const taken: T[] = [];
  const left: T[] = [];
  for (const zone of SORT_ZONES) {
    const pool = shuffled(cards.filter((c) => c.correctZone === zone));
    const want = TRIAL_CARD_MIX[zone];
    taken.push(...pool.slice(0, want));
    left.push(...pool.slice(want));
  }
  if (taken.length < limit) taken.push(...shuffled(left).slice(0, limit - taken.length));
  return shuffled(taken).slice(0, limit);
}

/**
 * Hồ sơ dựng giáo án: bốc thẳng, không chia tầng — số hồ sơ mỗi lượt bằng đúng
 * số hồ sơ khay ăn, vì đây cũng là một case study nặng ngang như thế.
 */
export function pickProgramCases<T extends { id: string }>(
  cases: T[],
  pinned: string[] | null,
  limit: number = TRIAL_BRIEFS_PER_ROUND
): T[] {
  if (pinned && pinned.length > 0) {
    const kept = byPinnedOrder(cases, pinned);
    if (kept.length > 0) return kept;
  }
  return shuffled(cases).slice(0, limit);
}

/**
 * Hồ sơ khay ăn: bốc theo NHÓM (xem TRIAL_BRIEF_MIX) — mỗi lượt đúng một khách
 * giảm cân, một khách cần tăng calo, một khách có ràng buộc bắt buộc.
 *
 * Nhóm nào ngân hàng chưa có thì bù bằng hồ sơ còn lại, để đề đang soạn dở vẫn
 * thi thử được. Hồ sơ chưa gắn nhóm coi như CUT — dữ liệu cũ không vì thế mà hỏng.
 */
export function pickMealBriefs<T extends { id: string; kind?: MealKind | null }>(
  briefs: T[],
  pinned: string[] | null,
  limit: number = TRIAL_BRIEFS_PER_ROUND
): T[] {
  if (pinned && pinned.length > 0) {
    const kept = byPinnedOrder(briefs, pinned);
    if (kept.length > 0) return kept;
  }

  const taken: T[] = [];
  const left: T[] = [];
  for (const kind of MEAL_KINDS) {
    // Hồ sơ chưa gắn nhóm, hoặc còn mang nhóm BULK đã bỏ, đều coi như CUT.
    const pool = shuffled(briefs.filter((b) => (b.kind === "SPECIAL" ? "SPECIAL" : "CUT") === kind));
    const want = TRIAL_BRIEF_MIX[kind];
    taken.push(...pool.slice(0, want));
    left.push(...pool.slice(want));
  }
  if (taken.length < limit) taken.push(...shuffled(left).slice(0, limit - taken.length));
  return shuffled(taken).slice(0, limit);
}

/**
 * CHỌN CÁC VÒNG CHO MỘT LƯỢT THI — bốc đề, không phải xếp thứ tự.
 *
 * Đề của cấp có đủ bảy đại tội, nhưng KHÔNG ai phải đi qua cả bảy trong một
 * buổi. Mỗi lượt thi chỉ lấy TRIAL_ROUNDS_PER_ATTEMPT vòng:
 *
 *   • Vòng của tội ĐÃ KHAI luôn đứng đầu — thí sinh tự nhận mình yếu ở đâu thì
 *     phải đối mặt với đúng chỗ đó trước, và vòng ấy bắt buộc phải qua.
 *   • Những vòng còn lại bốc NGẪU NHIÊN cho đủ số. Không ai đoán được kỳ này
 *     rơi vào tội nào, nên ôn tủ hay mách nhau thứ tự đều vô nghĩa.
 *
 * Bộ vòng đã bốc được CHỐT vào lượt thi ngay lần mở đề đầu tiên và tái dùng ở
 * mọi lần tải sau: F5 không phải là cách bốc lại cho tới khi ra đề dễ. Đúng
 * cách đề trắc nghiệm ghim đề đã bốc — chính là công dụng của questionIds.
 *
 * Vòng lạ trong bộ đã chốt (Admin vừa xoá) thì bỏ qua. Nhưng vòng MỚI thêm sau
 * khi đã chốt thì không nhét thêm vào: đề đổi giữa kỳ không được làm dài thêm
 * lượt thi mà người ta đang ngồi làm dở.
 */
export function pickTrialRounds<T extends { id: string; sin: string | null }>(
  rounds: T[],
  declaredSin: string | null,
  pinnedJson?: string | null,
  limit: number = TRIAL_ROUNDS_PER_ATTEMPT,
): T[] {
  const byId = new Map(rounds.map((r) => [r.id, r]));

  if (pinnedJson) {
    try {
      const ids = JSON.parse(pinnedJson);
      if (Array.isArray(ids) && ids.length > 0) {
        const kept = ids
          .filter((id): id is string => typeof id === "string")
          .map((id) => byId.get(id))
          .filter((r): r is T => !!r);
        if (kept.length > 0) return kept;
      }
    } catch {
      /* bộ đã chốt hỏng → bốc lại */
    }
  }

  const declared = declaredSin ? rounds.filter((r) => r.sin === declaredSin) : [];
  const declaredIds = new Set(declared.map((r) => r.id));
  const rest = rounds.filter((r) => !declaredIds.has(r.id));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...declared, ...rest].slice(0, Math.max(1, limit));
}
