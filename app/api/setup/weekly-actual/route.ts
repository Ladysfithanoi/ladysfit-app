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
    // actuals (revenueActual is computed from SalesLead, never sent by client)
    fitpartnerRevenueActual?: number;
    fitActual?: number; cooperationActual?: number;
    transformActual?: number; googleReviewActual?: number; cvActual?: number;
    weeklyTaskNotes?: string;
    // per-week targets
    revenueTarget?: number; fitpartnerRevenueTarget?: number;
    fitTarget?: number; cooperationTarget?: number;
    transformTarget?: number; googleReviewTarget?: number; cvTarget?: number;
  };

  const { monthlyTargetId, weekNumber, weekStart, weekEnd } = body;
  if (!monthlyTargetId || !weekNumber) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const target = await prisma.monthlyTarget.findUnique({ where: { id: monthlyTargetId } });
  if (!target) return NextResponse.json({ error: "Không tìm thấy mục tiêu" }, { status: 404 });

  const isFM = role === "FM";
  const isAdmin = role === "ADMIN";
  const isCOO = role === "COO";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  // FM can always update their OWN row; otherwise restricted to managed branches
  if (isFM && target.userId !== session.user.id && !managedBranchIds.includes(target.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // CEO_FitPartner chỉ được XEM — không ghi số liệu/ghi chú tuần. (COO ngang quyền Admin)
  // Non-FM/Admin/COO can only update their own row.
  if (!isFM && !isAdmin && !isCOO && target.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canWriteNotes = isFM || isAdmin || isCOO;

  // Build partial update — only include fields that were explicitly sent
  const updateFields: Record<string, unknown> = {};
  if (body.fitpartnerRevenueActual !== undefined) updateFields.fitpartnerRevenueActual = body.fitpartnerRevenueActual;
  if (body.fitActual !== undefined) updateFields.fitActual = body.fitActual;
  if (body.cooperationActual !== undefined) updateFields.cooperationActual = body.cooperationActual;
  if (body.transformActual !== undefined) updateFields.transformActual = body.transformActual;
  if (body.googleReviewActual !== undefined) updateFields.googleReviewActual = body.googleReviewActual;
  if (body.cvActual !== undefined) updateFields.cvActual = body.cvActual;
  if (canWriteNotes && body.weeklyTaskNotes !== undefined) updateFields.weeklyTaskNotes = body.weeklyTaskNotes ?? null;
  if (body.revenueTarget !== undefined) updateFields.revenueTarget = body.revenueTarget;
  if (body.fitpartnerRevenueTarget !== undefined) updateFields.fitpartnerRevenueTarget = body.fitpartnerRevenueTarget;
  if (body.fitTarget !== undefined) updateFields.fitTarget = body.fitTarget;
  if (body.cooperationTarget !== undefined) updateFields.cooperationTarget = body.cooperationTarget;
  if (body.transformTarget !== undefined) updateFields.transformTarget = body.transformTarget;
  if (body.googleReviewTarget !== undefined) updateFields.googleReviewTarget = body.googleReviewTarget;
  if (body.cvTarget !== undefined) updateFields.cvTarget = body.cvTarget;

  const updated = await prisma.weeklyActual.upsert({
    where: { monthlyTargetId_weekNumber: { monthlyTargetId, weekNumber } },
    update: updateFields,
    create: {
      monthlyTargetId, weekNumber,
      weekStart: new Date(weekStart), weekEnd: new Date(weekEnd),
      revenueActual: 0,
      fitpartnerRevenueActual: body.fitpartnerRevenueActual ?? 0,
      fitActual: body.fitActual ?? 0,
      cooperationActual: body.cooperationActual ?? 0,
      transformActual: body.transformActual ?? 0,
      googleReviewActual: body.googleReviewActual ?? 0,
      cvActual: body.cvActual ?? 0,
      weeklyTaskNotes: canWriteNotes ? (body.weeklyTaskNotes ?? null) : null,
      revenueTarget: body.revenueTarget ?? 0,
      fitpartnerRevenueTarget: body.fitpartnerRevenueTarget ?? 0,
      fitTarget: body.fitTarget ?? 0,
      cooperationTarget: body.cooperationTarget ?? 0,
      transformTarget: body.transformTarget ?? 0,
      googleReviewTarget: body.googleReviewTarget ?? 0,
      cvTarget: body.cvTarget ?? 0,
    },
  });

  return NextResponse.json(updated);
}
