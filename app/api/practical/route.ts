export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isComplete,
  totalScoreOf,
  maxScoreFor,
  type PracticalScores,
  type PracticalExercise,
} from "@/lib/practical-rubric";
import {
  computePtStats,
  evaluatePt,
  getActiveLevels,
  tryPromotePt,
} from "@/lib/pt-promotion";

// PT trong phạm vi người dùng: ADMIN xem tất cả, FM chỉ cơ sở mình quản lý.
async function ptsInScope(role: string, managedBranchIds: string[]) {
  if (role === "ADMIN") {
    return prisma.user.findMany({
      where: { role: "PT", deletedAt: null },
      select: ptSelect,
      orderBy: { name: "asc" },
    });
  }
  // FM
  return prisma.user.findMany({
    where: { role: "PT", deletedAt: null, branchId: { in: managedBranchIds } },
    select: ptSelect,
    orderBy: { name: "asc" },
  });
}

const ptSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  branchId: true,
  branch: { select: { id: true, name: true } },
  ptLevel: {
    select: {
      id: true,
      name: true,
      color: true,
      order: true,
      retestIntervalDays: true,
      promoteMinAvgRevenue: true,
      promoteMinTransform: true,
    },
  },
} as const;

// GET: tổng quan điều kiện thăng hạng của các PT trong phạm vi.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "FM") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const managedBranchIds = session.user.managedBranchIds ?? [];
  const pts = await ptsInScope(role, managedBranchIds);
  const year = new Date().getFullYear();
  const [levels, stats, sys, branches] = await Promise.all([
    getActiveLevels(),
    computePtStats(pts.map((p) => p.id), year),
    prisma.systemConfig.findUnique({ where: { id: "main" } }),
    // Danh sách cơ sở để lọc: ADMIN xem tất cả, FM chỉ cơ sở mình quản lý.
    prisma.branch.findMany({
      where: role === "ADMIN" ? {} : { id: { in: managedBranchIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const passPercent = sys?.practicalPassPercent ?? 70;
  const enableLevelSystem = sys?.enableLevelSystem !== false;

  // Lần chấm thực hành gần nhất mỗi PT
  const lastPracticals = await prisma.practicalAssessment.findMany({
    where: { ptId: { in: pts.map((p) => p.id) } },
    orderBy: { createdAt: "desc" },
    select: { ptId: true, passed: true, totalScore: true, maxScore: true, createdAt: true },
  });
  const lastByPt = new Map<string, (typeof lastPracticals)[number]>();
  for (const lp of lastPracticals) if (!lastByPt.has(lp.ptId)) lastByPt.set(lp.ptId, lp);

  const rows = await Promise.all(
    pts.map(async (p) => {
      const stat = stats.get(p.id) ?? { avgMonthlyRevenue: 0, transformedCount: 0 };
      const ev = await evaluatePt(p, levels, stat);
      const lp = lastByPt.get(p.id) ?? null;
      return {
        ptId: p.id,
        name: p.name ?? p.email,
        branchId: p.branchId,
        branchName: p.branch?.name ?? null,
        levelName: p.ptLevel?.name ?? null,
        levelColor: p.ptLevel?.color ?? null,
        nextLevelName: ev.nextLevelName,
        nextLevelId: ev.nextLevelId,
        conditions: ev.conditions,
        eligible: ev.eligible,
        lastPractical: lp
          ? { passed: lp.passed, totalScore: lp.totalScore, maxScore: lp.maxScore, createdAt: lp.createdAt.toISOString() }
          : null,
      };
    })
  );

  return NextResponse.json({ rows, branches, passPercent, enableLevelSystem });
}

// POST: lưu 1 lần chấm thực hành cho 1 PT.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "FM") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    ptId: string;
    exercisesCount?: number;
    scores: PracticalScores;
    exercises: PracticalExercise[];
    notes?: string;
  };

  if (!body.ptId || !body.scores || !Array.isArray(body.exercises)) {
    return NextResponse.json({ error: "Thiếu dữ liệu chấm" }, { status: 400 });
  }

  const pt = await prisma.user.findUnique({
    where: { id: body.ptId },
    select: { id: true, role: true, branchId: true, ptLevel: { select: { name: true } } },
  });
  if (!pt || pt.role !== "PT") {
    return NextResponse.json({ error: "Không tìm thấy PT" }, { status: 404 });
  }
  // FM chỉ được chấm PT thuộc cơ sở mình quản lý.
  if (role === "FM") {
    const branchIds = session.user.managedBranchIds ?? [];
    if (!pt.branchId || !branchIds.includes(pt.branchId)) {
      return NextResponse.json({ error: "Không có quyền chấm PT này" }, { status: 403 });
    }
  }

  if (!isComplete(body.scores, body.exercises)) {
    return NextResponse.json({ error: "Vui lòng chấm đủ tất cả tiêu chí và các bài tập" }, { status: 400 });
  }

  const exercisesCount = body.exercises.length;
  const total = totalScoreOf(body.scores, body.exercises);
  const max = maxScoreFor(exercisesCount);
  const sys = await prisma.systemConfig.findUnique({ where: { id: "main" } });
  const passPercent = sys?.practicalPassPercent ?? 70;
  const passed = max > 0 && (total / max) * 100 >= passPercent;

  await prisma.practicalAssessment.create({
    data: {
      ptId: pt.id,
      assessorId: session.user.id,
      levelName: pt.ptLevel?.name ?? null,
      exercisesCount,
      scores: JSON.stringify(body.scores),
      exercises: JSON.stringify(body.exercises),
      totalScore: total,
      maxScore: max,
      passed,
      notes: body.notes?.trim() || null,
    },
  });

  // Chấm xong thử xét thăng hạng ngay (nếu đủ cả 4 điều kiện).
  const promoted = await tryPromotePt(pt.id);

  return NextResponse.json({ totalScore: total, maxScore: max, passPercent, passed, promoted });
}
