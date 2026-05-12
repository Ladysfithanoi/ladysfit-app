import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "FM" && role !== "CEO_FITPARTNER" && role !== "COO") {
    return NextResponse.json({ error: "Chỉ FM hoặc CEO có thể cập nhật ghi chú" }, { status: 403 });
  }

  const body = await req.json() as {
    monthlyTargetId: string;
    weekNumber: number;
    weekStart: string;
    weekEnd: string;
    weeklyTaskNotes: string | null;
  };

  const { monthlyTargetId, weekNumber, weekStart, weekEnd } = body;
  if (!monthlyTargetId || !weekNumber) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const target = await prisma.monthlyTarget.findUnique({ where: { id: monthlyTargetId } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];
  if (isFM && !managedBranchIds.includes(target.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.weeklyActual.findUnique({
    where: { monthlyTargetId_weekNumber: { monthlyTargetId, weekNumber } },
  });

  const result = existing
    ? await prisma.weeklyActual.update({
        where: { id: existing.id },
        data: { weeklyTaskNotes: body.weeklyTaskNotes ?? null },
      })
    : await prisma.weeklyActual.create({
        data: {
          monthlyTargetId,
          weekNumber,
          weekStart: new Date(weekStart),
          weekEnd: new Date(weekEnd),
          weeklyTaskNotes: body.weeklyTaskNotes ?? null,
        },
      });

  return NextResponse.json(result);
}
