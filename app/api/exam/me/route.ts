import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const [user, lastAttempt, lastPassedAttempt, config, sysConfig] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, freeUpgradedAt: true, updatedAt: true },
    }),
    prisma.examAttempt.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.examAttempt.findFirst({
      where: { userId, passed: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.examConfig.findFirst(),
    prisma.systemConfig.findUnique({ where: { id: "main" } }),
  ]);

  const passingScore = config?.passingScore ?? 80;
  const numQuestions = config?.numQuestions ?? 10;
  const enableLevelSystem = sysConfig?.enableLevelSystem ?? true;

  // Upgrade date: freeUpgradedAt is the canonical source for the 30-day window
  const upgradeDate =
    user?.freeUpgradedAt ?? lastPassedAttempt?.createdAt ?? user?.updatedAt ?? null;

  let daysLeft: number | null = null;
  let expired = false;

  if (user?.role === "FREE" && upgradeDate) {
    // Strip time components so the comparison is purely day-based
    const upgraded = new Date(upgradeDate);
    upgraded.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUsed = Math.floor((today.getTime() - upgraded.getTime()) / (1000 * 60 * 60 * 24));
    daysLeft = Math.max(0, 30 - daysUsed);
    expired = daysLeft <= 0;
  }

  return NextResponse.json({
    role: user?.role,
    upgradeDate: upgradeDate?.toISOString() ?? null,
    freeUpgradedAt: user?.freeUpgradedAt?.toISOString() ?? null,
    daysLeft,
    expired,
    lastAttempt: lastAttempt
      ? {
          id: lastAttempt.id,
          score: lastAttempt.score,
          total: lastAttempt.total,
          passed: lastAttempt.passed,
          createdAt: lastAttempt.createdAt.toISOString(),
        }
      : null,
    passingScore,
    numQuestions,
    enableLevelSystem,
  });
}
