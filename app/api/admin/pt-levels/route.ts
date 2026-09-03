import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeExamNumQuestions, normalizeExamPassingScore } from "@/lib/exam-level";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";

  if (isAdmin) {
    const levels = await prisma.pTLevel.findMany({
      orderBy: { order: "asc" },
      include: {
        phaseAccess: { include: { phase: true } },
        _count: { select: { users: { where: { deletedAt: null } } } },
      },
    });
    return NextResponse.json(levels);
  }

  // Non-admin: return minimal list of active levels (for staff form dropdowns)
  const levels = await prisma.pTLevel.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: { id: true, name: true, color: true, retestIntervalDays: true, monthlyTarget: true, promoteMinAvgRevenue: true, promoteMinTransform: true, examNumQuestions: true, examPassingScore: true, isDefault: true, isActive: true, order: true },
  });
  return NextResponse.json(levels);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name: string;
    color?: string;
    retestIntervalDays?: number;
    monthlyTarget?: number;
    promoteMinAvgRevenue?: number;
    promoteMinTransform?: number;
    examNumQuestions?: number | null;
    examPassingScore?: number | null;
    isDefault?: boolean;
    phaseIds?: string[];
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Tên cấp độ không được trống" }, { status: 400 });
  }

  const maxOrder = await prisma.pTLevel.aggregate({ _max: { order: true } });
  const nextOrder = (maxOrder._max.order ?? 0) + 1;

  if (body.isDefault) {
    await prisma.pTLevel.updateMany({ data: { isDefault: false } });
  }

  const level = await prisma.pTLevel.create({
    data: {
      name: body.name.trim(),
      order: nextOrder,
      color: body.color ?? "#6b7280",
      retestIntervalDays: body.retestIntervalDays ?? 30,
      monthlyTarget: body.monthlyTarget != null && body.monthlyTarget > 0 ? Math.round(body.monthlyTarget) : 38,
      promoteMinAvgRevenue: body.promoteMinAvgRevenue != null && body.promoteMinAvgRevenue >= 0 ? body.promoteMinAvgRevenue : 0,
      promoteMinTransform: body.promoteMinTransform != null && body.promoteMinTransform >= 0 ? Math.round(body.promoteMinTransform) : 0,
      // Đề riêng của cấp: bỏ trống = dùng số chung trong cấu hình bài thi.
      examNumQuestions: normalizeExamNumQuestions(body.examNumQuestions),
      examPassingScore: normalizeExamPassingScore(body.examPassingScore),
      isDefault: body.isDefault ?? false,
      phaseAccess: body.phaseIds?.length
        ? { create: body.phaseIds.map((phaseId) => ({ phaseId, hasAccess: true })) }
        : undefined,
    },
    include: {
      phaseAccess: { include: { phase: true } },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json(level);
}
