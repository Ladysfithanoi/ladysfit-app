import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExamWindow } from "@/lib/exam-schedule";
import { DEFAULT_RANK_WEIGHTS } from "@/lib/ranking-config";
import { ExamAdminPage } from "@/components/dashboard/exam/exam-admin-page";

export default async function ExamPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [questions, configRaw, attempts] = await Promise.all([
    prisma.examQuestion.findMany({ orderBy: { order: "asc" } }),
    prisma.examConfig.findFirst(),
    prisma.examAttempt.findMany({
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
    }),
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
  }[] = [];

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
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Lần thi gần nhất trong kỳ của mỗi PT
    const byUser = new Map<string, (typeof windowAttempts)[number]>();
    for (const a of windowAttempts) {
      if (!byUser.has(a.userId)) byUser.set(a.userId, a);
    }

    roster = pts.map((pt) => {
      const a = byUser.get(pt.id);
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
        rankWeightExam: config.rankWeightExam,
        rankWeightRevenue: config.rankWeightRevenue,
        rankWeightTransform: config.rankWeightTransform,
      }}
      attempts={serializedAttempts}
      windowState={window.state}
      roster={roster}
    />
  );
}
