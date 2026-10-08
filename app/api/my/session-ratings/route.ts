import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { MAX_COMMENT_LENGTH, RATING_WINDOW_DAYS, isValidScore } from "@/lib/session-rating";

// GET  /api/my/session-ratings — buổi gần nhất khách chưa chấm (trong hạn), hoặc null.
// POST /api/my/session-ratings — { workoutLogId, score 1-5, comment? } chấm một buổi.

export async function GET() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - RATING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const log = await prisma.workoutLog.findFirst({
    where: {
      clientId: session.user.id,
      status: "COMPLETED",
      rating: null,
      OR: [{ checkOutAt: { gte: since } }, { checkOutAt: null, sessionDate: { gte: since } }],
    },
    orderBy: { sessionDate: "desc" },
    select: {
      id: true,
      sessionDate: true,
      checkOutAt: true,
      createdBy: { select: { name: true } },
      session: { select: { sessionName: true } },
    },
  });

  if (!log) return NextResponse.json(null);
  return NextResponse.json({
    workoutLogId: log.id,
    date: (log.checkOutAt ?? log.sessionDate).toISOString(),
    ptName: log.createdBy.name ?? "PT",
    sessionName: log.session.sessionName,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { workoutLogId?: string; score?: unknown; comment?: string | null }
    | null;
  if (!body?.workoutLogId || !isValidScore(body.score)) {
    return NextResponse.json({ error: "Vui lòng chọn số sao từ 1 đến 5" }, { status: 400 });
  }

  const log = await prisma.workoutLog.findFirst({
    where: { id: body.workoutLogId, clientId: session.user.id, status: "COMPLETED" },
    select: { id: true, createdById: true, rating: { select: { id: true } }, client: { select: { branchId: true } } },
  });
  if (!log) return NextResponse.json({ error: "Không tìm thấy buổi tập" }, { status: 404 });
  if (log.rating) return NextResponse.json({ error: "Chị đã chấm buổi tập này rồi" }, { status: 409 });

  const comment = (body.comment ?? "").trim().slice(0, MAX_COMMENT_LENGTH) || null;
  try {
    const rating = await prisma.sessionRating.create({
      data: {
        workoutLogId: log.id,
        clientId: session.user.id,
        ptId: log.createdById,
        branchId: log.client.branchId,
        score: body.score,
        comment,
      },
      select: { id: true, score: true },
    });
    return NextResponse.json(rating, { status: 201 });
  } catch (e) {
    // Bấm gửi hai lần cùng lúc: lần sau đụng khoá duy nhất workoutLogId.
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Chị đã chấm buổi tập này rồi" }, { status: 409 });
    }
    throw e;
  }
}
