import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeExamNumQuestions, normalizeExamPassingScore , trialField } from "@/lib/exam-level";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    color?: string;
    retestIntervalDays?: number;
    monthlyTarget?: number;
    promoteMinAvgRevenue?: number;
    promoteMinTransform?: number;
    examNumQuestions?: number | null;
    examPassingScore?: number | null;
    examFormat?: "FLAT" | "TRIAL";
    trialRoundsPerAttempt?: number | null;
    trialCaseRounds?: number | null;
    trialCardsPerRound?: number | null;
    trialItemsPerCase?: number | null;
    isDefault?: boolean;
    isActive?: boolean;
  };

  if (body.isDefault) {
    await prisma.pTLevel.updateMany({ data: { isDefault: false } });
  }

  const level = await prisma.pTLevel.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.retestIntervalDays !== undefined && { retestIntervalDays: body.retestIntervalDays }),
      ...(body.monthlyTarget !== undefined && body.monthlyTarget > 0 && { monthlyTarget: Math.round(body.monthlyTarget) }),
      ...(body.promoteMinAvgRevenue !== undefined && body.promoteMinAvgRevenue >= 0 && { promoteMinAvgRevenue: body.promoteMinAvgRevenue }),
      ...(body.promoteMinTransform !== undefined && body.promoteMinTransform >= 0 && { promoteMinTransform: Math.round(body.promoteMinTransform) }),
      // Đề riêng của cấp: gửi lên null/rỗng = quay về dùng số chung.
      ...(body.examNumQuestions !== undefined && { examNumQuestions: normalizeExamNumQuestions(body.examNumQuestions) }),
      ...(body.examPassingScore !== undefined && { examPassingScore: normalizeExamPassingScore(body.examPassingScore) }),
      ...((body.examFormat === "FLAT" || body.examFormat === "TRIAL") && { examFormat: body.examFormat }),
      // Cấu hình đề thử thách: gửi lên rỗng = quay về số mặc định.
      ...(body.trialRoundsPerAttempt !== undefined && { trialRoundsPerAttempt: trialField(body.trialRoundsPerAttempt, "roundsPerAttempt") }),
      ...(body.trialCaseRounds !== undefined && { trialCaseRounds: trialField(body.trialCaseRounds, "caseRounds") }),
      ...(body.trialCardsPerRound !== undefined && { trialCardsPerRound: trialField(body.trialCardsPerRound, "cardsPerRound") }),
      ...(body.trialItemsPerCase !== undefined && { trialItemsPerCase: trialField(body.trialItemsPerCase, "itemsPerCase") }),
      ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    include: {
      phaseAccess: { include: { phase: true } },
      _count: { select: { users: { where: { deletedAt: null } } } },
    },
  });

  return NextResponse.json(level);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const level = await prisma.pTLevel.findUnique({
    where: { id: params.id },
    include: { _count: { select: { users: true } } },
  });

  if (!level) {
    return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  }

  if (level._count.users > 0) {
    return NextResponse.json(
      { error: `Cấp độ này có ${level._count.users} nhân sự, không thể xóa` },
      { status: 400 }
    );
  }

  await prisma.pTLevel.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
