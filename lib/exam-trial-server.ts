import { prisma } from "@/lib/prisma";
import { recordAttempt } from "@/lib/exam-grading";
import { examSettingsForLevel } from "@/lib/exam-level";
import {
  gradeMealBrief, gradeSortCard, scoreRound, scoreTrial, sortPillar,
  parseTrialState, readMealEntries, readSortAnswer,
  type MealEntry, type Pillar, type RoundScore, type SortZone, type TrialScore,
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
export async function gradeTrialAttempt(opts: {
  userId: string;
  userName: string;
  levelId: string;
  passingScore: number;
  violations: number;
  noPenalty: boolean;
  /** Bài làm: { roundId: { briefId: MealEntry[] | cardId: SortZone } } */
  state: unknown;
}): Promise<TrialGradeOutcome> {
  const state = parseTrialState(typeof opts.state === "string" ? opts.state : JSON.stringify(opts.state));

  const rounds = await prisma.examRound.findMany({
    where: { levelId: opts.levelId, isActive: true },
    orderBy: { order: "asc" },
    include: {
      mealBriefs: { orderBy: { order: "asc" } },
      sortCards: { orderBy: { order: "asc" } },
    },
  });
  if (rounds.length === 0) return { ok: false, error: "Đề của cấp này chưa có vòng nào" };

  const roundScores: RoundScore[] = [];
  const details: { roundId: string; detail: string; pillar: Pillar }[] = [];

  for (const round of rounds) {
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
            tolerancePercent: b.tolerancePercent,
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

      roundScores.push(scoreRound(round, results.map((r) => r.ratio), pillar));
      details.push({ roundId: round.id, detail: JSON.stringify(results), pillar });
    } else {
      const results = round.sortCards.map((c) => {
        const answer: SortZone | null = readSortAnswer(state, round.id, c.id);
        return gradeSortCard({ id: c.id, correctZone: c.correctZone }, answer);
      });
      const pillar = sortPillar(results);
      roundScores.push(scoreRound(round, results.map((r) => r.ratio), pillar));
      details.push({ roundId: round.id, detail: JSON.stringify(results), pillar });
    }
  }

  const result = scoreTrial(roundScores, opts.passingScore);

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
