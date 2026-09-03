import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Soạn đề thử thách nhiều vòng (7 đại tội). Chỉ Admin.
 *
 * GET trả về CẢ đáp án (vùng đúng của từng thẻ, lời giải của từng hồ sơ) — đây
 * là màn soạn đề, không phải màn làm bài. Đường gửi đề cho thí sinh là
 * lib/exam-trial-server.ts, ở đó đáp án bị cắt trước khi ra khỏi server.
 */

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const levelId = new URL(req.url).searchParams.get("levelId");
  if (!levelId) return NextResponse.json({ error: "Thiếu levelId" }, { status: 400 });

  const rounds = await prisma.examRound.findMany({
    where: { levelId },
    orderBy: { order: "asc" },
    include: {
      mealBriefs: { orderBy: { order: "asc" } },
      sortCards: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json(rounds);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { levelId, type, name } = body as { levelId?: string; type?: string; name?: string };

  if (!levelId || !name?.trim()) {
    return NextResponse.json({ error: "Thiếu cấp độ hoặc tên vòng" }, { status: 400 });
  }
  if (type !== "MEAL" && type !== "SORT") {
    return NextResponse.json({ error: "Loại vòng không hợp lệ" }, { status: 400 });
  }

  const level = await prisma.pTLevel.findUnique({ where: { id: levelId }, select: { id: true } });
  if (!level) return NextResponse.json({ error: "Không tìm thấy cấp độ" }, { status: 404 });

  const max = await prisma.examRound.aggregate({ where: { levelId }, _max: { order: true } });

  const round = await prisma.examRound.create({
    data: {
      levelId,
      type,
      name: name.trim(),
      order: (max._max.order ?? -1) + 1,
    },
    include: { mealBriefs: true, sortCards: true },
  });

  return NextResponse.json(round, { status: 201 });
}
