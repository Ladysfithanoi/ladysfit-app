import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExamWindow, SUBMIT_GRACE_MS } from "@/lib/exam-schedule";
import { checkCanSitExam } from "@/lib/exam-required-fm";
import { ALREADY_TAKEN_MESSAGE, SESSION_EXPIRED_MESSAGE, parseQuestionIds, sessionDeadline } from "@/lib/exam-session";
import { resolveExamLevel } from "@/lib/exam-level";
import { gradeTrialAttempt } from "@/lib/exam-trial-server";
import { evaluatePtById } from "@/lib/pt-promotion";

/**
 * Nộp bài đề thử thách nhiều vòng.
 *
 * Song song với POST /api/exam/attempts của đề trắc nghiệm và giữ NGUYÊN mọi
 * luật của nó — khung giờ, mỗi người một lượt, hết giờ là không nộp được, giành
 * lượt bằng update có điều kiện. Khác đúng một chỗ: cách tính điểm.
 *
 * Client chỉ gửi BÀI LÀM. Chỉ tiêu và đáp án đúng luôn nạp lại từ cơ sở dữ liệu
 * lúc chấm, nên sửa gói tin gửi lên không nâng điểm được.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const userId = session.user.id;

  const allowed = await checkCanSitExam(userId, role);
  if (!allowed.ok) return NextResponse.json({ error: allowed.message }, { status: 403 });

  // Bài của FM chỉ ghi nhận điểm cho Admin xem: không thăng, không hạ.
  const noPenalty = role === "FM";

  const body = await req.json().catch(() => ({}));
  const state = (body as { trialState?: unknown }).trialState;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return NextResponse.json({ error: "Thiếu bài làm" }, { status: 400 });
  }

  const [config, sysConfig] = await Promise.all([
    prisma.examConfig.findFirst(),
    prisma.systemConfig.findUnique({ where: { id: "main" } }),
  ]);

  const resolved = await resolveExamLevel({ userId, role, config });
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: 403 });
  const { levelId, passingScore, format } = resolved.settings;

  if (format !== "TRIAL" || !levelId) {
    return NextResponse.json({ error: "Đề của cấp bạn không phải đề nhiều vòng" }, { status: 400 });
  }
  if (!noPenalty && sysConfig?.enableLevelSystem === false) {
    return NextResponse.json({ error: "Hệ thống phân cấp độ đang tắt" }, { status: 403 });
  }

  // Chỉ nhận bài trong khung giờ thi (cộng ít phút cho bài đang nộp dở)
  const window = getExamWindow({
    scheduleEnabled: config?.scheduleEnabled ?? false,
    examDate: config?.examDate ?? null,
    examStartTime: config?.examStartTime ?? "00:00",
    examEndTime: config?.examEndTime ?? "23:59",
  });
  const withinGrace =
    window.state === "AFTER" &&
    !!window.endAt &&
    Date.now() - window.endAt.getTime() <= SUBMIT_GRACE_MS;
  if (!window.open && !withinGrace) {
    return NextResponse.json({ error: window.message }, { status: 403 });
  }

  const examKey = config?.examDate ?? null;
  const examSession = examKey
    ? await prisma.examSession.findUnique({ where: { userId_examKey: { userId, examKey } } })
    : null;

  if (examSession?.submittedAt) {
    return NextResponse.json({ error: ALREADY_TAKEN_MESSAGE }, { status: 403 });
  }
  if (!examSession) {
    // Đề nhiều vòng luôn tạo lượt thi lúc mở đề, nên không có lượt nghĩa là
    // người này chưa từng mở đề — không có gì để nộp.
    return NextResponse.json({ error: "Bạn chưa mở đề thi của kỳ này" }, { status: 403 });
  }

  const deadline = sessionDeadline(examSession, window.endAt);
  if (deadline && Date.now() > deadline.getTime() + SUBMIT_GRACE_MS) {
    return NextResponse.json({ error: SESSION_EXPIRED_MESSAGE }, { status: 403 });
  }

  // Chốt lượt TRƯỚC khi chấm: bấm Nộp hai lần, hoặc hết giờ tự nộp trùng lúc
  // người thi bấm nộp, thì chỉ một bên đi qua được.
  const claimed = await prisma.examSession.updateMany({
    where: { id: examSession.id, submittedAt: null },
    data: { submittedAt: new Date(), trialState: JSON.stringify(state) },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: ALREADY_TAKEN_MESSAGE }, { status: 403 });
  }

  const graded = await gradeTrialAttempt({
    userId,
    userName: session.user.name ?? session.user.email ?? "PT",
    levelId,
    passingScore,
    violations: examSession.violations,
    noPenalty,
    state,
    // Tội đã khai chốt từ lúc mở đề — chấm phải theo đúng nó.
    declaredSin: examSession.declaredSin,
    // Chỉ chấm ĐÚNG những vòng đã bốc cho lượt này. Chấm cả bảy vòng của đề thì
    // những vòng người ta chưa từng nhìn thấy đều thành 0 điểm.
    roundIds: parseQuestionIds(examSession.questionIds),
  });

  if (!graded.ok) {
    // Chấm hỏng thì trả lượt về chưa nộp, không thì người thi mất bài mà cũng
    // không vào lại được.
    await prisma.examSession.update({
      where: { id: examSession.id },
      data: { submittedAt: null },
    });
    return NextResponse.json({ error: graded.error }, { status: 400 });
  }

  await prisma.examSession.update({
    where: { id: examSession.id },
    data: { attemptId: graded.attemptId },
  });

  // Ba ô trên cùng của cây là ba điều kiện thăng cấp còn lại — gửi kèm để màn
  // kết quả cho thấy cả con đường lên cấp, không chỉ mỗi bài thi vừa làm.
  const promotion = noPenalty ? null : await evaluatePtById(userId).catch(() => null);

  return NextResponse.json({
    promotion: promotion
      ? Object.fromEntries(promotion.conditions.map((c) => [c.key, { ok: c.ok, detail: c.detail }]))
      : null,
    scorePct: graded.result.scorePct,
    score: graded.result.score,
    total: graded.result.total,
    penalty: graded.result.penalty,
    passed: graded.result.passed,
    declaredFailed: graded.result.declaredFailed,
    declaredSin: examSession.declaredSin,
    promoted: graded.promoted,
    pillar: graded.result.pillar,
    rounds: graded.result.rounds,
    noPenalty,
  });
}
