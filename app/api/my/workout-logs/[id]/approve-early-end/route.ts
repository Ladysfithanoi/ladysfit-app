import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";

// POST /api/my/workout-logs/[id]/approve-early-end
// The CLIENT (authenticated on their own device) agrees to end the current live
// session early — e.g. they have to leave but still want the session counted for
// the PT. Stamps earlyEndApprovedAt so the PT can check out and credit the
// teaching session without the usual min-duration / 6-exercise gates.
// Idempotent: re-approving keeps the original approval time.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(clientAuthOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const log = await prisma.workoutLog.findFirst({
      where: { id: params.id, clientId: session.user.id, status: "IN_PROGRESS" },
    });
    if (!log) {
      return NextResponse.json({ error: "Không tìm thấy buổi tập đang diễn ra" }, { status: 404 });
    }

    if (!log.earlyEndApprovedAt) {
      await prisma.workoutLog.update({
        where: { id: log.id },
        data: { earlyEndApprovedAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[my workout-logs approve-early-end]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
