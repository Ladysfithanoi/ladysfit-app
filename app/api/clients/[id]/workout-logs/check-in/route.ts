import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/clients/[id]/workout-logs/check-in
// Starts a session: creates an IN_PROGRESS workout log with a server-side
// check-in timestamp and a scaffold of empty set logs (one per movement).
// Does NOT increment sessionsUsed — that only happens on a valid check-out.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { programId, weekId, sessionId } = (await req.json()) as {
      programId?: string;
      weekId?: string;
      sessionId?: string;
    };
    if (!programId || !weekId || !sessionId) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }

    // Resume: if an in-progress session already exists for this client+session,
    // return it instead of creating a duplicate (handles page reloads).
    const existing = await prisma.workoutLog.findFirst({
      where: { clientId: params.id, sessionId, status: "IN_PROGRESS" },
      include: {
        setLogs: { orderBy: { id: "asc" } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return NextResponse.json(serialize(existing));
    }

    // Build the set-log scaffold from the session's current movements.
    const workoutSession = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: { movements: { orderBy: { order: "asc" } } },
    });
    if (!workoutSession) {
      return NextResponse.json({ error: "Không tìm thấy buổi tập" }, { status: 404 });
    }

    const now = new Date();
    const log = await prisma.workoutLog.create({
      data: {
        clientId: params.id,
        programId,
        weekId,
        sessionId,
        sessionDate: now,
        status: "IN_PROGRESS",
        checkInAt: now,
        createdById: session.user.id,
        setLogs: {
          create: workoutSession.movements.map((m) => ({
            movementId: m.id,
            movementName: m.movementName,
            exerciseName: m.selectedExercise,
          })),
        },
      },
      include: {
        setLogs: { orderBy: { id: "asc" } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(serialize(log));
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[workout-logs check-in]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}

type LogWithRelations = Awaited<ReturnType<typeof prisma.workoutLog.findFirstOrThrow>> & {
  setLogs: unknown[];
  createdBy: { id: string; name: string | null };
};

function serialize(log: LogWithRelations) {
  return {
    ...log,
    sessionDate: log.sessionDate.toISOString(),
    createdAt: log.createdAt.toISOString(),
    checkInAt: log.checkInAt?.toISOString() ?? null,
    checkOutAt: log.checkOutAt?.toISOString() ?? null,
    firstInteractionAt: log.firstInteractionAt?.toISOString() ?? null,
  };
}
