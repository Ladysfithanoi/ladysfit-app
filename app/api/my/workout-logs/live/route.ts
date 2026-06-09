import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";

// GET /api/my/workout-logs/live
// The authenticated CLIENT's currently-running session(s) — the ones the PT has
// checked in but not yet checked out. Drives the "buổi đang diễn ra" card where
// the client can approve ending early. Polled by the portal so a session shows up
// shortly after the PT checks in and disappears once it's checked out.
export async function GET() {
  try {
    const session = await getServerSession(clientAuthOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const logs = await prisma.workoutLog.findMany({
      where: { clientId: session.user.id, status: "IN_PROGRESS" },
      include: {
        session: { select: { sessionName: true } },
        program: { select: { phase: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { checkInAt: "desc" },
    });

    return NextResponse.json(
      logs.map((l) => ({
        id: l.id,
        sessionName: l.session.sessionName,
        phase: l.program.phase,
        ptName: l.createdBy.name ?? null,
        checkInAt: l.checkInAt?.toISOString() ?? null,
        earlyEndApprovedAt: l.earlyEndApprovedAt?.toISOString() ?? null,
      }))
    );
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[my workout-logs live]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
