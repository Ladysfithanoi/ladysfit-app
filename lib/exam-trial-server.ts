import { prisma } from "@/lib/prisma";
import { recordAttempt } from "@/lib/exam-grading";
import { examSettingsForLevel } from "@/lib/exam-level";
import {
  gradeMealBrief, gradeSortCard, scoreRound, scoreTrial, sortPillar,
  parseTrialState, readMealEntries, readSortAnswer,
  applyDeclaredSin, declaredTolerance,
  type MealEntry, type Pillar, type RoundScore, type Sin, type SortZone, type TrialScore,
} from "@/lib/exam-trial";

/**
 * Phần đụng cơ sở dữ liệu của đề thử thách nhiều vòng.
 * Luật chấm nằm hết ở lib/exam-trial.ts (dùng chung với client); file này chỉ
 * nạp đề, gọi luật đó, rồi ghi kết quả.
 */

/** Món cấm lưu dạng JSON mảng — hỏng thì coi như không cấm gì, đừng làm sập bài thi. */
export function parseBannedFoods(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/** Đề thử thách của một cấp, đã bỏ đáp án — an toàn để gửi xuống trang làm bài. */
export async function loadTrialForCandidate(levelId: string) {
  const rounds = await prisma.examRound.findMany({
    where: { levelId, isActive: true },
    orderBy: { order: "asc" },
    include: {
      mealBriefs: { orderBy: { order: "asc" } },
      sortCards: { orderBy: { order: "asc" } },
    },
  });

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
      bannedFoods: parseBannedFoods(b.bannedFoods),
      // explanation KHÔNG gửi đi — đó là lời giải, chỉ hiện sau khi chấm.
    })),
    // correctZone KHÔNG gửi đi, nếu không mở F12 là thấy hết đáp án.
    cards: r.sortCards.map((c) => ({ id: c.id, text: c.text })),
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
  type: "MEAL" | "SORT";
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
  declaredSin: Sin | null = null
): Promise<{ ok: false; error: string } | ({ ok: true; state: TrialStateShape } & ComputedTrial)> {
  const state = parseTrialState(typeof rawState === "string" ? rawState : JSON.stringify(rawState));

  const rounds = await prisma.examRound.findMany({
    where: { levelId, isActive: true },
    orderBy: { order: "asc" },
    include: {
      mealBriefs: { orderBy: { order: "asc" } },
      sortCards: { orderBy: { order: "asc" } },
    },
  });
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
            bannedFoods: parseBannedFoods(b.bannedFoods),
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
      });
    } else {
      const results = round.sortCards.map((c) => {
        const answer: SortZone | null = readSortAnswer(state, round.id, c.id);
        return gradeSortCard({ id: c.id, correctZone: c.correctZone }, answer);
      });
      const pillar = sortPillar(results);
      const rs = scoreRound(scored, results.map((r) => r.ratio), pillar, tuned.declared);
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
  round: { id: string; name: string; sin: string | null; type: "MEAL" | "SORT" },
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
}): Promise<TrialGradeOutcome> {
  const computed = await computeTrial(opts.levelId, opts.state, opts.passingScore, opts.declaredSin ?? null);
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
  T extends { mealBriefs: { bannedFoods: string | null }[] }
>(round: T) {
  return {
    ...round,
    mealBriefs: round.mealBriefs.map((b) => ({
      ...b,
      bannedFoods: parseBannedFoods(b.bannedFoods),
    })),
  };
}
