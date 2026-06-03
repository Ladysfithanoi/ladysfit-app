import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { incrementPackageAndNotify, serializeWorkoutLog } from "@/lib/workout-session";

const INCLUDE = {
  setLogs: { orderBy: { id: "asc" } },
  createdBy: { select: { id: true, name: true } },
} as const;

// POST /api/my/workout-logs/[id]/confirm
// The CLIENT (authenticated on their own device) confirms or rejects a session
// the PT marked as AWAITING_CONFIRMATION. Confirming here is the strong,
// anti-forgery proof that the client was actually present.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(clientAuthOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const clientId = session.user.id;
    const { action } = (await req.json()) as { action?: "confirm" | "reject" };

    const log = await prisma.workoutLog.findFirst({
      where: { id: params.id, clientId, status: "AWAITING_CONFIRMATION" },
    });
    if (!log) {
      return NextResponse.json({ error: "Không tìm thấy buổi tập cần xác nhận" }, { status: 404 });
    }

    if (action === "reject") {
      const voided = await prisma.workoutLog.update({
        where: { id: log.id },
        data: { status: "VOID", voidReason: "Khách báo không tập buổi này" },
        include: INCLUDE,
      });
      return NextResponse.json({ ...serializeWorkoutLog(voided), confirmed: false });
    }

    const now = new Date();
    const completed = await prisma.workoutLog.update({
      where: { id: log.id },
      data: { status: "COMPLETED", confirmationMethod: "CLIENT_APP", confirmedAt: now },
      include: INCLUDE,
    });

    await incrementPackageAndNotify(clientId, completed);

    return NextResponse.json({ ...serializeWorkoutLog(completed), confirmed: true });
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[my workout-logs confirm]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
