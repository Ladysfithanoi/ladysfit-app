import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const config = configRaw ?? { id: "", numQuestions: 10, passingScore: 80, updatedAt: new Date() };

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
      config={{ numQuestions: config.numQuestions, passingScore: config.passingScore }}
      attempts={serializedAttempts}
    />
  );
}
