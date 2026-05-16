import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;

  const body = await req.json() as {
    monthlyTargetId: string; weekNumber: number;
    weekStart: string; weekEnd: string;
    revenueActual?: number; fitpartnerRevenueActual?: number;
    fitActual?: number; cooperationActual?: number;
    transformActual?: number; googleReviewActual?: number; cvActual?: number;
    weeklyTaskNotes?: string;
  };

  const { monthlyTargetId, weekNumber, weekStart, weekEnd } = body;
  if (!monthlyTargetId || !weekNumber) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const target = await prisma.monthlyTarget.findUnique({ where: { id: monthlyTargetId } });
  if (!target) return NextResponse.json({ error: "Không tìm thấy mục tiêu" }, { status: 404 });

  const isFM = role === "FM";
  const isAdmin = role === "ADMIN";
  const isCEO = role === "CEO_FITPARTNER" || role === "COO";
  const isPT = role === "PT";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (isFM && !managedBranchIds.includes(target.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // PT and ADMIN can only update their own target's actuals
  if ((isPT || isAdmin) && target.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canWriteNotes = isFM || isAdmin || isCEO;

  const updated = await prisma.weeklyActual.upsert({
    where: { monthlyTargetId_weekNumber: { monthlyTargetId, weekNumber } },
    update: {
      revenueActual: body.revenueActual ?? 0,
      fitpartnerRevenueActual: body.fitpartnerRevenueActual ?? 0,
      fitActual: body.fitActual ?? 0,
      cooperationActual: body.cooperationActual ?? 0,
      transformActual: body.transformActual ?? 0,
      googleReviewActual: body.googleReviewActual ?? 0,
      cvActual: body.cvActual ?? 0,
      ...(canWriteNotes ? { weeklyTaskNotes: body.weeklyTaskNotes ?? null } : {}),
    },
    create: {
      monthlyTargetId, weekNumber,
      weekStart: new Date(weekStart), weekEnd: new Date(weekEnd),
      revenueActual: body.revenueActual ?? 0,
      fitpartnerRevenueActual: body.fitpartnerRevenueActual ?? 0,
      fitActual: body.fitActual ?? 0,
      cooperationActual: body.cooperationActual ?? 0,
      transformActual: body.transformActual ?? 0,
      googleReviewActual: body.googleReviewActual ?? 0,
      cvActual: body.cvActual ?? 0,
      weeklyTaskNotes: canWriteNotes ? (body.weeklyTaskNotes ?? null) : null,
    },
  });

  return NextResponse.json(updated);
}
