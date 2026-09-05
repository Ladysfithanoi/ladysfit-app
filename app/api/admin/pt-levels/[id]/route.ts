import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeExamNumQuestions, normalizeExamPassingScore , trialField, trialStreakTiersField, declaredField } from "@/lib/exam-level";

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
    /** Thanh Thanh danh ở vòng thường: mốc đầy và hao mỗi thẻ. */
    trialHonorStart?: number | null;
    trialCostNear?: number | null;
    trialCostFar?: number | null;
    /** Bảng mốc phạt sai liên tiếp — mảng [{streak, penalty}], rỗng = tắt. */
    trialStreakTiers?: unknown;
    /** Độ gắt riêng của vòng đã khai — bỏ trống ô nào thì dùng mặc định. */
    trialDeclaredMultiplier?: number | null;
    trialDeclaredMustPass?: boolean | null;
    trialDeclaredPassBonus?: number | null;
    trialDeclaredPassCap?: number | null;
    trialDeclaredHonorStart?: number | null;
    trialDeclaredCostNear?: number | null;
    trialDeclaredCostFar?: number | null;
    trialDeclaredStreakTiers?: unknown;
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
      ...(body.trialHonorStart !== undefined && { trialHonorStart: trialField(body.trialHonorStart, "honorStart") }),
      ...(body.trialCostNear !== undefined && { trialCostNear: trialField(body.trialCostNear, "costNear") }),
      ...(body.trialCostFar !== undefined && { trialCostFar: trialField(body.trialCostFar, "costFar") }),
      ...(body.trialStreakTiers !== undefined && { trialStreakTiers: trialStreakTiersField(body.trialStreakTiers) }),
      // Vòng đã khai: gửi lên rỗng = quay về mặc định trong lib/exam-trial.ts.
      ...(body.trialDeclaredMultiplier !== undefined && { trialDeclaredMultiplier: declaredField(body.trialDeclaredMultiplier, "pointMultiplier") }),
      // Không phải boolean thì để null = dùng mặc định (BẬT), chứ không đoán.
      ...(body.trialDeclaredMustPass !== undefined && {
        trialDeclaredMustPass: typeof body.trialDeclaredMustPass === "boolean" ? body.trialDeclaredMustPass : null,
      }),
      ...(body.trialDeclaredPassBonus !== undefined && { trialDeclaredPassBonus: declaredField(body.trialDeclaredPassBonus, "passBonus") }),
      ...(body.trialDeclaredPassCap !== undefined && { trialDeclaredPassCap: declaredField(body.trialDeclaredPassCap, "passCap") }),
      ...(body.trialDeclaredHonorStart !== undefined && { trialDeclaredHonorStart: declaredField(body.trialDeclaredHonorStart, "honorStart") }),
      ...(body.trialDeclaredCostNear !== undefined && { trialDeclaredCostNear: declaredField(body.trialDeclaredCostNear, "costNear") }),
      ...(body.trialDeclaredCostFar !== undefined && { trialDeclaredCostFar: declaredField(body.trialDeclaredCostFar, "costFar") }),
      ...(body.trialDeclaredStreakTiers !== undefined && { trialDeclaredStreakTiers: trialStreakTiersField(body.trialDeclaredStreakTiers) }),
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
