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
  if (role !== "RESTRICTED" && role !== "FREE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { answers } = body as { answers: Record<string, string> };

  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "Thiếu câu trả lời" }, { status: 400 });
  }

  const config = await prisma.examConfig.findFirst();
  const passingScore = config?.passingScore ?? 80;

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

  // If passed and role is RESTRICTED, upgrade to FREE
  if (passed && role === "RESTRICTED") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { role: "FREE", freeUpgradedAt: new Date() },
    });

    // Create admin notification
    const userName = session.user.name ?? session.user.email ?? "PT";
    await prisma.upgradeNotification.create({
      data: { userId: session.user.id, userName, passed: true },
    });
  } else if (!passed) {
    const userName = session.user.name ?? session.user.email ?? "PT";
    await prisma.upgradeNotification.create({
      data: { userId: session.user.id, userName, passed: false },
    });
  }

  return NextResponse.json({ attempt, scorePct, passed, correctCount, total });
}
