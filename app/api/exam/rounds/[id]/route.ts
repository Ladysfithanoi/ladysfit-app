import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SORT_ZONES, type SortZone } from "@/lib/exam-trial";
import { serializeRoundForAdmin } from "@/lib/exam-trial-server";

/** Số nguyên trong khoảng, ngoài khoảng thì giữ giá trị cũ. */
function clampInt(raw: unknown, min: number, max: number, current: number): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return current;
  return n;
}

/** Chỉ tiêu dinh dưỡng: bỏ trống = vòng không chấm chỉ tiêu đó. */
function optionalTarget(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100_000) return null;
  return Math.round(n);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const round = await prisma.examRound.findUnique({ where: { id: params.id } });
  if (!round) return NextResponse.json({ error: "Không tìm thấy vòng" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const b = body as Record<string, unknown>;

  // ── Nội dung vòng: thay cả cụm ────────────────────────────────────────────
  // Sửa từng thẻ một thì phải theo dõi thẻ nào mới, thẻ nào vừa bị xoá, thẻ nào
  // đổi thứ tự — nhiều đường sai. Màn soạn đề gửi lên trọn bộ, server xoá sạch
  // rồi ghi lại. Bài thi đã nộp không bị ảnh hưởng: ExamRoundResult chép lại
  // điểm và điểm tối đa của vòng ngay lúc chấm.
  const briefs = Array.isArray(b.briefs) ? (b.briefs as Record<string, unknown>[]) : null;
  const cards = Array.isArray(b.cards) ? (b.cards as Record<string, unknown>[]) : null;

  if (round.type === "MEAL" && briefs) {
    const clean = briefs
      .filter((x) => typeof x.clientProfile === "string" && x.clientProfile.trim())
      .map((x, i) => ({
        roundId: round.id,
        order: i,
        clientProfile: String(x.clientProfile).trim(),
        targetCalories: optionalTarget(x.targetCalories),
        targetProtein: optionalTarget(x.targetProtein),
        targetFat: optionalTarget(x.targetFat),
        targetCarbs: optionalTarget(x.targetCarbs),
        tolerancePercent: clampInt(x.tolerancePercent, 1, 100, 10),
        bannedFoods: Array.isArray(x.bannedFoods)
          ? JSON.stringify((x.bannedFoods as unknown[]).filter((f): f is string => typeof f === "string" && !!f.trim()))
          : null,
        explanation: typeof x.explanation === "string" && x.explanation.trim() ? x.explanation.trim() : null,
      }));
    await prisma.examMealBrief.deleteMany({ where: { roundId: round.id } });
    if (clean.length > 0) await prisma.examMealBrief.createMany({ data: clean });
  }

  if (round.type === "SORT" && cards) {
    const clean = cards
      .filter(
        (x) =>
          typeof x.text === "string" && x.text.trim() &&
          typeof x.correctZone === "string" &&
          (SORT_ZONES as string[]).includes(x.correctZone)
      )
      .map((x, i) => ({
        roundId: round.id,
        order: i,
        text: String(x.text).trim(),
        correctZone: x.correctZone as SortZone,
        explanation: typeof x.explanation === "string" && x.explanation.trim() ? x.explanation.trim() : null,
      }));
    await prisma.examSortCard.deleteMany({ where: { roundId: round.id } });
    if (clean.length > 0) await prisma.examSortCard.createMany({ data: clean });
  }

  const updated = await prisma.examRound.update({
    where: { id: params.id },
    data: {
      ...(typeof b.name === "string" && b.name.trim() && { name: b.name.trim() }),
      ...("intro" in b && { intro: typeof b.intro === "string" && b.intro.trim() ? b.intro.trim() : null }),
      ...("order" in b && { order: clampInt(b.order, 0, 999, round.order) }),
      ...("maxPoints" in b && { maxPoints: clampInt(b.maxPoints, 1, 1000, round.maxPoints) }),
      ...("passPercent" in b && { passPercent: clampInt(b.passPercent, 1, 100, round.passPercent) }),
      ...("failPenalty" in b && { failPenalty: clampInt(b.failPenalty, 0, 1000, round.failPenalty) }),
      ...(typeof b.isActive === "boolean" && { isActive: b.isActive }),
    },
    include: {
      mealBriefs: { orderBy: { order: "asc" } },
      sortCards: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json(serializeRoundForAdmin(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Xoá vòng kéo theo xoá kết quả vòng đó của các bài đã thi (khoá ngoại
  // cascade). Tổng điểm trong ExamAttempt không đổi — nó đã được chốt lúc chấm.
  await prisma.examRound.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
