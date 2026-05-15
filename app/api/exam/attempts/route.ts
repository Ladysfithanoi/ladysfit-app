import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const attempts = await prisma.examAttempt.findMany({
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(attempts);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "PT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { answers } = body as { answers: Record<string, string> };

  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "Thiếu câu trả lời" }, { status: 400 });
  }

  const [config, sysConfig] = await Promise.all([
    prisma.examConfig.findFirst(),
    prisma.systemConfig.findUnique({ where: { id: "main" } }),
  ]);
  const passingScore = config?.passingScore ?? 80;

  if (sysConfig?.enableLevelSystem === false) {
    return NextResponse.json({ error: "Hệ thống phân cấp độ đang tắt" }, { status: 403 });
  }

  // Fetch the actual questions to grade
  const questionIds = Object.keys(answers);
  const questions = await prisma.examQuestion.findMany({
    where: { id: { in: questionIds } },
  });

  const total = questions.length;
  if (total === 0) {
    return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 400 });
  }

  const correctCount = questions.filter((q) => answers[q.id] === q.correct).length;
  const scorePct = Math.round((correctCount / total) * 100);
  const passed = scorePct >= passingScore;

  const attempt = await prisma.examAttempt.create({
    data: {
      userId: session.user.id,
      score: correctCount,
      total,
      passed,
      answers: JSON.stringify(answers),
    },
  });

  const userName = session.user.name ?? session.user.email ?? "PT";

  if (passed) {
    // Upgrade to next ptLevel if one exists above the current level
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ptLevelId: true, ptLevel: { select: { order: true } } },
    });
    const nextLevel = await prisma.pTLevel.findFirst({
      where: {
        isActive: true,
        order: { gt: currentUser?.ptLevel?.order ?? -1 },
      },
      orderBy: { order: "asc" },
    });
    if (nextLevel) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { ptLevelId: nextLevel.id },
      });
    }
    await prisma.upgradeNotification.create({
      data: { userId: session.user.id, userName, passed: true },
    });
  } else {
    await prisma.upgradeNotification.create({
      data: { userId: session.user.id, userName, passed: false },
    });
  }

  return NextResponse.json({ attempt, scorePct, passed, correctCount, total });
}
