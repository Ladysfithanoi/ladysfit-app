import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExamWindow } from "@/lib/exam-schedule";
import { sessionDeadline } from "@/lib/exam-session";
import { parseAnswers } from "@/lib/exam-grading";
import { DEFAULT_RANK_WEIGHTS } from "@/lib/ranking-config";
import { ExamAdminPage } from "@/components/dashboard/exam/exam-admin-page";

export default async function ExamPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [questions, configRaw, attempts, fmUsers, requiredFMs] = await Promise.all([
    prisma.examQuestion.findMany({ orderBy: { order: "asc" } }),
    prisma.examConfig.findFirst(),
    prisma.examAttempt.findMany({
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Danh sách FM để Admin tick ai phải thi — xem lib/exam-required-fm.ts.
    prisma.user.findMany({
      where: { role: "FM", deletedAt: null },
      select: { id: true, name: true, email: true, branch: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.examRequiredFM.findMany({ select: { userId: true } }),
  ]);

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
      where: { examKey: config.examDate, submittedAt: null, answers: { not: null } },
      select: {
        answers: true,
        startedAt: true,
        durationMinutes: true,
        penaltyMinutes: true,
        lastViolationAt: true,
      },
    });
    const now = Date.now();
    pendingGradeCount = pending.filter((s) => {
      if (Object.keys(parseAnswers(s.answers)).length === 0) return false;
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

  const serializedAttempts = attempts.map((a) => ({
    id: a.id,
    userId: a.userId,
    score: a.score,
    total: a.total,
    passed: a.passed,
    createdAt: a.createdAt.toISOString(),
    violations: a.violations,
    user: a.user,
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
      }}
      attempts={serializedAttempts}
      windowState={window.state}
      roster={roster}
      fms={fms}
      pendingGradeCount={pendingGradeCount}
    />
  );
}
