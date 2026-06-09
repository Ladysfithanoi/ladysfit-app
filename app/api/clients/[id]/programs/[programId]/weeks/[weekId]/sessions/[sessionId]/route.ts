import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reversePackageSession } from "@/lib/workout-session";

const sessionInclude = {
  orderBy: { order: "asc" as const },
  include: { movements: { orderBy: { order: "asc" as const } } },
};

// DELETE /api/clients/[id]/programs/[programId]/weeks/[weekId]/sessions/[sessionId]
// Removes a single session slot (Buổi A/B/…) from a week. Movements and any
// WorkoutLogs for the session cascade-delete, so we first un-count every
// COMPLETED log it had (decrement the package's sessionsUsed and re-open it if it
// had auto-completed). Re-creating + logging a session later counts again.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; programId: string; weekId: string; sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workoutSession = await prisma.workoutSession.findFirst({
      where: { id: params.sessionId, weekId: params.weekId, programId: params.programId },
      select: { id: true },
    });
    if (!workoutSession) {
      return NextResponse.json({ error: "Không tìm thấy buổi tập" }, { status: 404 });
    }

    // Keep at least one session per week so the week is never left empty.
    const sessionCount = await prisma.workoutSession.count({ where: { weekId: params.weekId } });
    if (sessionCount <= 1) {
      return NextResponse.json(
        { error: "Không thể xóa buổi tập cuối cùng của tuần. Mỗi tuần cần ít nhất 1 buổi." },
        { status: 400 }
      );
    }

    let packageUpdate: {
      id: string; sessionsUsed: number; sessions: number; packageName: string; status: string;
    } | null = null;

    // Reverse the session count for every package-counted log this session had
    // (counted at check-in, so this covers both in-progress and completed logs).
    // Refund each log against the exact lộ trình it was charged so multiple
    // active packages stay correct.
    const countedLogs = await prisma.workoutLog.findMany({
      where: { clientId: params.id, sessionId: params.sessionId, packageCounted: true },
      select: { packageEnrollmentId: true },
    });
    for (const counted of countedLogs) {
      const reversed = await reversePackageSession(params.id, counted.packageEnrollmentId);
      if (reversed) packageUpdate = reversed;
    }

    await prisma.workoutSession.delete({ where: { id: params.sessionId } });

    const week = await prisma.workoutWeek.findUnique({
      where: { id: params.weekId },
      include: { sessions: sessionInclude },
    });

    return NextResponse.json({ week, deletedSessionId: params.sessionId, packageUpdate });
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[workout session delete]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
