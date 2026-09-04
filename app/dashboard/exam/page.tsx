import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExamWindow } from "@/lib/exam-schedule";
import { sessionDeadline } from "@/lib/exam-session";
import { parseAnswers } from "@/lib/exam-grading";
import { parseTrialState } from "@/lib/exam-trial";
import { DEFAULT_RANK_WEIGHTS } from "@/lib/ranking-config";
import { ExamAdminPage } from "@/components/dashboard/exam/exam-admin-page";

export default async function ExamPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [questionRows, configRaw, attempts, fmUsers, requiredFMs, levels] = await Promise.all([
    // Mỗi câu kèm các cấp đang dùng nó — tab Ngân hàng đề lọc và gắn cấp tại chỗ.
    prisma.examQuestion.findMany({
      orderBy: { order: "asc" },
      include: { levels: { select: { levelId: true } } },
    }),
    prisma.examConfig.findFirst(),
    prisma.examAttempt.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        level: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Danh sách FM để Admin tick ai phải thi — xem lib/exam-required-fm.ts.
    prisma.user.findMany({
      where: { role: "FM", deletedAt: null },
      select: { id: true, name: true, email: true, branch: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.examRequiredFM.findMany({ select: { userId: true } }),
    // Cấp độ đang bật, kèm số câu đề của từng cấp đang có.
    prisma.pTLevel.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true, name: true, color: true, order: true,
        examNumQuestions: true, examPassingScore: true, examFormat: true,
        _count: { select: { examQuestions: true } },
      },
    }),
  ]);

  const questions = questionRows.map(({ levels: qLevels, ...q }) => ({
    ...q,
    levelIds: qLevels.map((l) => l.levelId),
  }));

  const levelOptions = levels.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
    order: l.order,
    numQuestions: l.examNumQuestions,
    passingScore: l.examPassingScore,
    questionCount: l._count.examQuestions,
    format: l.examFormat,
  }));

  const config = configRaw ?? {
    id: "",
    numQuestions: 10,
    passingScore: 80,
    shuffleQuestions: true,
    scheduleEnabled: false,
    examDate: null as string | null,
    examStartTime: "00:00",
    examEndTime: "23:59",
    durationMinutes: 0,
    focusPenaltyMinutes: 30,
    rankWeightExam: DEFAULT_RANK_WEIGHTS.exam,
    rankWeightRevenue: DEFAULT_RANK_WEIGHTS.revenue,
    rankWeightTransform: DEFAULT_RANK_WEIGHTS.transform,
    fmLevelId: null as string | null,
    updatedAt: new Date(),
  };

  const schedule = {
    scheduleEnabled: config.scheduleEnabled,
    examDate: config.examDate,
    examStartTime: config.examStartTime,
    examEndTime: config.examEndTime,
  };
  const window = getExamWindow(schedule);

  // Lượt thi hết giờ mà không ai nộp, nhưng phần đã làm vẫn được tự lưu lại —
  // Admin thu về được bằng nút "Chấm bài đã lưu" ở tab Lịch thi.
  let pendingGradeCount = 0;
  if (config.examDate) {
    const pending = await prisma.examSession.findMany({
      // Dem ca hai duong: de trac nghiem luu o answers, de nhieu vong o trialState.
      where: {
        examKey: config.examDate,
        submittedAt: null,
        OR: [{ answers: { not: null } }, { trialState: { not: null } }],
      },
      select: {
        answers: true,
        trialState: true,
        startedAt: true,
        durationMinutes: true,
        penaltyMinutes: true,
        lastViolationAt: true,
      },
    });
    const now = Date.now();
    pendingGradeCount = pending.filter((s) => {
      const hasWork =
        Object.keys(parseAnswers(s.answers)).length > 0 ||
        Object.keys(parseTrialState(s.trialState)).length > 0;
      if (!hasWork) return false;
      const deadline = sessionDeadline(s, window.endAt);
      // Chưa đặt thời lượng thì lượt chỉ hết hạn khi phòng thi đóng cửa.
      return deadline ? deadline.getTime() <= now : !window.open;
    }).length;
  }

  // Danh sách dự thi của kỳ thi đang đặt lịch: PT nào không thi tính 0 điểm.
  let roster: {
    userId: string;
    name: string | null;
    email: string;
    levelName: string | null;
    levelColor: string | null;
    score: number | null;
    total: number | null;
    scorePct: number;
    passed: boolean;
    takenAt: string | null;
    violations: number;
  }[] = [];

  // Bài thi trong kỳ của từng người — dùng chung cho bảng HLV và bảng FM.
  const attemptByUser = new Map<
    string,
    { score: number; total: number; passed: boolean; createdAt: Date; violations: number }
  >();

  if (window.startAt && window.endAt) {
    const [pts, windowAttempts] = await Promise.all([
      prisma.user.findMany({
        where: { role: "PT", deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          ptLevel: { select: { name: true, color: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.examAttempt.findMany({
        where: { createdAt: { gte: window.startAt, lte: window.endAt } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Mỗi người chỉ thi một lần một kỳ. Dữ liệu cũ lỡ có hai bài thì lấy bài
    // ĐẦU TIÊN — bài sau là lần thi thừa, không tính.
    for (const a of windowAttempts) {
      if (!attemptByUser.has(a.userId)) attemptByUser.set(a.userId, a);
    }

    roster = pts.map((pt) => {
      const a = attemptByUser.get(pt.id);
      return {
        userId: pt.id,
        name: pt.name,
        email: pt.email,
        levelName: pt.ptLevel?.name ?? null,
        levelColor: pt.ptLevel?.color ?? null,
        score: a ? a.score : null,
        total: a ? a.total : null,
        // Không thi => 0 điểm
        scorePct: a && a.total > 0 ? Math.round((a.score / a.total) * 100) : 0,
        passed: a ? a.passed : false,
        takenAt: a ? a.createdAt.toISOString() : null,
        violations: a?.violations ?? 0,
      };
    });
  }

  // Toàn bộ FM kèm cờ "bắt buộc thi" và điểm của kỳ này. Khác bảng HLV ở chỗ
  // FM không thi thì để trống chứ không tính 0 điểm — họ không nằm trong xếp
  // hạng và không bị phạt vì bài thi này (lib/exam-required-fm.ts).
  const requiredIds = new Set(requiredFMs.map((r) => r.userId));
  const fms = fmUsers.map((fm) => {
    const a = attemptByUser.get(fm.id);
    return {
      userId: fm.id,
      name: fm.name,
      email: fm.email,
      branchName: fm.branch?.name ?? null,
      required: requiredIds.has(fm.id),
      score: a ? a.score : null,
      total: a ? a.total : null,
      scorePct: a && a.total > 0 ? Math.round((a.score / a.total) * 100) : null,
      passed: a ? a.passed : false,
      takenAt: a ? a.createdAt.toISOString() : null,
      violations: a?.violations ?? 0,
    };
  });

  // Quyền vào thi từng người — Admin mở / khoá / gia hạn / cho thi lại ngay
  // trong tab Lịch thi, khỏi phải nhờ sửa cơ sở dữ liệu.
  let accessRows: {
    userId: string;
    name: string | null;
    email: string;
    role: string;
    branchName: string | null;
    blocked: boolean;
    startedAt: string | null;
    endsAt: string | null;
    submittedAt: string | null;
    savedCount: number;
    scorePct: number | null;
    passed: boolean;
    takenAt: string | null;
  }[] = [];

  if (config.examDate) {
    const [staff, sessions, blocks] = await Promise.all([
      prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [{ role: "PT" }, { role: "FM", examRequirement: { isNot: null } }],
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          branch: { select: { name: true } },
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      prisma.examSession.findMany({ where: { examKey: config.examDate } }),
      prisma.examBlock.findMany({
        where: { examKey: config.examDate },
        select: { userId: true },
      }),
    ]);

    const sessionByUser = new Map(sessions.map((s) => [s.userId, s]));
    const blockedIds = new Set(blocks.map((b) => b.userId));

    accessRows = staff.map((u) => {
      const s = sessionByUser.get(u.id);
      const a = attemptByUser.get(u.id);
      const deadline = s ? sessionDeadline(s, window.endAt) : null;
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        branchName: u.branch?.name ?? null,
        blocked: blockedIds.has(u.id),
        startedAt: s ? s.startedAt.toISOString() : null,
        endsAt: deadline ? deadline.toISOString() : null,
        submittedAt: s?.submittedAt ? s.submittedAt.toISOString() : null,
        savedCount: s ? Object.keys(parseAnswers(s.answers)).length : 0,
        scorePct: a && a.total > 0 ? Math.round((a.score / a.total) * 100) : null,
        passed: a ? a.passed : false,
        takenAt: a ? a.createdAt.toISOString() : null,
      };
    });
  }

  const serializedAttempts = attempts.map((a) => ({
    id: a.id,
    userId: a.userId,
    score: a.score,
    total: a.total,
    passed: a.passed,
    createdAt: a.createdAt.toISOString(),
    violations: a.violations,
    user: a.user,
    // Bài này là đề của cấp nào. Bài cũ trước khi phân cấp thì để trống.
    level: a.level,
  }));

  return (
    <ExamAdminPage
      questions={questions.map((q) => ({ ...q, createdAt: q.createdAt.toISOString() }))}
      config={{
        numQuestions: config.numQuestions,
        passingScore: config.passingScore,
        shuffleQuestions: config.shuffleQuestions,
        scheduleEnabled: config.scheduleEnabled,
        examDate: config.examDate,
        examStartTime: config.examStartTime,
        examEndTime: config.examEndTime,
        durationMinutes: config.durationMinutes,
        focusPenaltyMinutes: config.focusPenaltyMinutes,
        rankWeightExam: config.rankWeightExam,
        rankWeightRevenue: config.rankWeightRevenue,
        rankWeightTransform: config.rankWeightTransform,
        fmLevelId: config.fmLevelId,
      }}
      levels={levelOptions}
      attempts={serializedAttempts}
      windowState={window.state}
      roster={roster}
      fms={fms}
      pendingGradeCount={pendingGradeCount}
      accessRows={accessRows}
    />
  );
}
