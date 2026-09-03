import { prisma } from "@/lib/prisma";
import { tryPromotePt } from "@/lib/pt-promotion";
import { examSettingsForLevel } from "@/lib/exam-level";

/**
 * ── Chấm bài và ghi kết quả ──────────────────────────────────────────────────
 *
 * Tách riêng vì có ba đường dẫn tới cùng một việc:
 *
 *   1. Người thi bấm Nộp bài (hoặc hết giờ máy tự nộp) — POST /api/exam/attempts.
 *   2. Người thi quay lại sau khi đã hết giờ mà bài chưa nộp được — lúc đó chấm
 *      từ phần đáp án đã tự lưu, xem app/api/exam/take.
 *   3. Admin bấm "Chấm bài đã lưu" cho những lượt hết giờ mà không ai nộp —
 *      POST /api/exam/grade-pending.
 *
 * Cả ba phải cho ra cùng một kết quả và cùng hệ quả (thăng cấp, thông báo), nên
 * chỉ được có một bản logic ở đây.
 */

export type GradeOutcome =
  | { ok: false; error: string }
  | {
      ok: true;
      attemptId: string;
      correctCount: number;
      total: number;
      scorePct: number;
      passed: boolean;
      promoted: boolean;
    };

/** Đáp án hợp lệ đọc ra từ JSON — hỏng thì trả object rỗng. */
export function parseAnswers(raw: unknown): Record<string, string> {
  if (typeof raw !== "string" || !raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Chấm bài, lưu vào lịch sử thi và xử lý hệ quả thăng cấp.
 *
 * `noPenalty` = bài của FM: điểm chỉ để Admin nắm chuyên môn, không thăng,
 * không hạ, không sinh thông báo (xem lib/exam-required-fm.ts).
 */
export async function gradeAndRecord(opts: {
  userId: string;
  userName: string;
  answers: Record<string, string>;
  passingScore: number;
  violations: number;
  noPenalty: boolean;
  /** Bài này là đề của cấp nào — quyết định điều kiện lý thuyết khi xét thăng cấp. */
  levelId: string | null;
}): Promise<GradeOutcome> {
  const questionIds = Object.keys(opts.answers);
  const questions = questionIds.length
    ? await prisma.examQuestion.findMany({ where: { id: { in: questionIds } } })
    : [];

  const total = questions.length;
  if (total === 0) {
    return { ok: false, error: "Không tìm thấy câu hỏi" };
  }

  const correctCount = questions.filter((q) => opts.answers[q.id] === q.correct).length;
  const scorePct = Math.round((correctCount / total) * 100);
  const passed = scorePct >= opts.passingScore;

  const attempt = await prisma.examAttempt.create({
    data: {
      userId: opts.userId,
      score: correctCount,
      total,
      passed,
      answers: JSON.stringify(opts.answers),
      violations: opts.violations,
      levelId: opts.levelId,
    },
  });

  let promoted = false;
  if (!opts.noPenalty) {
    if (passed) {
      // Đậu lý thuyết CHỈ là một trong các điều kiện — chỉ thăng hạng nếu đủ cả
      // (thực hành đạt + doanh số + transform). Ngược lại vẫn ghi nhận đậu để chờ.
      promoted = await tryPromotePt(opts.userId);
      if (!promoted) {
        await prisma.upgradeNotification.create({
          data: { userId: opts.userId, userName: opts.userName, passed: true },
        });
      }
    } else {
      await prisma.upgradeNotification.create({
        data: { userId: opts.userId, userName: opts.userName, passed: false },
      });
    }
  }

  return {
    ok: true,
    attemptId: attempt.id,
    correctCount,
    total,
    scorePct,
    passed,
    promoted,
  };
}

/**
 * Chấm một lượt thi đã hết giờ mà không ai nộp, dựa trên đáp án đã tự lưu.
 *
 * Giành lượt bằng update có điều kiện submittedAt = null nên gọi song song từ
 * hai chỗ cũng chỉ một bên chấm được. Không có đáp án đã lưu thì bỏ qua — đó là
 * người mở đề rồi bỏ đi, tính vắng thi như cũ.
 */
export async function gradePendingSession(
  sessionId: string,
  /** Điểm đạt chung, chỉ dùng khi cấp của lượt thi không đặt riêng. */
  fallbackPassingScore: number
): Promise<GradeOutcome> {
  const examSession = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: { user: { select: { name: true, email: true, role: true } } },
  });

  if (!examSession) return { ok: false, error: "Không tìm thấy lượt thi" };
  if (examSession.submittedAt) return { ok: false, error: "Lượt thi này đã nộp bài rồi" };

  const answers = parseAnswers(examSession.answers);
  if (Object.keys(answers).length === 0) {
    return { ok: false, error: "Lượt thi này không có bài làm nào được lưu" };
  }

  const claimed = await prisma.examSession.updateMany({
    where: { id: examSession.id, submittedAt: null },
    data: { submittedAt: new Date() },
  });
  if (claimed.count === 0) return { ok: false, error: "Lượt thi này đã nộp bài rồi" };

  // Điểm đạt lấy theo cấp đã chốt lúc mở đề, không phải cấp hiện tại của người
  // thi: bài chấm muộn mà lúc đó họ vừa được thăng cấp thì vẫn phải chấm bằng
  // thước của đề họ đã làm.
  const settings = await examSettingsForLevel(examSession.levelId, {
    passingScore: fallbackPassingScore,
  });

  const result = await gradeAndRecord({
    userId: examSession.userId,
    userName: examSession.user.name ?? examSession.user.email ?? "PT",
    answers,
    passingScore: settings.passingScore,
    violations: examSession.violations,
    noPenalty: examSession.user.role === "FM",
    levelId: examSession.levelId,
  });

  if (result.ok) {
    await prisma.examSession.update({
      where: { id: examSession.id },
      data: { attemptId: result.attemptId },
    });
  } else {
    // Chấm không thành thì trả lượt về trạng thái chưa nộp để còn thử lại.
    await prisma.examSession.update({
      where: { id: examSession.id },
      data: { submittedAt: null },
    });
  }

  return result;
}
