import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");

  const logs = await prisma.workoutLog.findMany({
    where: {
      clientId: params.id,
      ...(sessionId ? { sessionId } : {}),
    },
    include: {
      setLogs: { orderBy: { id: "asc" } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { sessionDate: "desc" },
  });

  return NextResponse.json(
    logs.map((l) => ({
      ...l,
      sessionDate: l.sessionDate.toISOString(),
      createdAt: l.createdAt.toISOString(),
    }))
  );
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { programId, weekId, sessionId, sessionDate, notes, setLogs } = body;

  if (!programId || !weekId || !sessionId || !sessionDate) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  type SetLogInput = {
    movementId?: string | null;
    movementName: string;
    exerciseName: string;
    set1Load?: number | null; set1Reps?: number | null;
    set2Load?: number | null; set2Reps?: number | null;
    set3Load?: number | null; set3Reps?: number | null;
    set4Load?: number | null; set4Reps?: number | null;
    set5Load?: number | null; set5Reps?: number | null;
    set6Load?: number | null; set6Reps?: number | null;
    exerciseNotes?: string | null;
  };

  const log = await prisma.workoutLog.create({
    data: {
      clientId: params.id,
      programId,
      weekId,
      sessionId,
      sessionDate: new Date(sessionDate),
      notes: notes || null,
      createdById: session.user.id,
      setLogs: {
        create: (setLogs as SetLogInput[]).map((sl) => ({
          movementId: sl.movementId || null,
          movementName: sl.movementName,
          exerciseName: sl.exerciseName,
          set1Load: sl.set1Load ?? null,
          set1Reps: sl.set1Reps ?? null,
          set2Load: sl.set2Load ?? null,
          set2Reps: sl.set2Reps ?? null,
          set3Load: sl.set3Load ?? null,
          set3Reps: sl.set3Reps ?? null,
          set4Load: sl.set4Load ?? null,
          set4Reps: sl.set4Reps ?? null,
          set5Load: sl.set5Load ?? null,
          set5Reps: sl.set5Reps ?? null,
          set6Load: sl.set6Load ?? null,
          set6Reps: sl.set6Reps ?? null,
          exerciseNotes: sl.exerciseNotes || null,
        })),
      },
    },
    include: {
      setLogs: { orderBy: { id: "asc" } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  // Increment sessionsUsed on the active package enrollment
  let packageUpdate: {
    id: string; sessionsUsed: number; sessions: number; packageName: string; status: string;
  } | null = null;

  const activePackage = await prisma.packageEnrollment.findFirst({
    where: { clientId: params.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  if (activePackage) {
    const newSessionsUsed = activePackage.sessionsUsed + 1;
    const newStatus = newSessionsUsed >= activePackage.sessions ? "COMPLETED" : "ACTIVE";
    const updated = await prisma.packageEnrollment.update({
      where: { id: activePackage.id },
      data: { sessionsUsed: newSessionsUsed, status: newStatus },
    });
    packageUpdate = {
      id: updated.id,
      sessionsUsed: updated.sessionsUsed,
      sessions: updated.sessions,
      packageName: updated.packageName,
      status: updated.status,
    };
  }

  // Create workout completion notification for client
  try {
    const [client, currentSession, program] = await Promise.all([
      prisma.client.findUnique({ where: { id: params.id }, select: { fullName: true } }),
      prisma.workoutSession.findUnique({ where: { id: sessionId }, select: { sessionName: true, order: true } }),
      prisma.workoutProgram.findUnique({
        where: { id: programId },
        select: {
          phase: true,
          workoutType: true,
          weeks: {
            where: { id: weekId },
            include: { sessions: { orderBy: { order: "asc" }, select: { sessionName: true, order: true } } },
          },
          sessions: {
            where: { weekId: null },
            orderBy: { order: "asc" },
            select: { sessionName: true, order: true },
          },
        },
      }),
    ]);

    if (client && currentSession && program) {
      const phase = program.phase;
      const allSessions =
        program.weeks[0]?.sessions.length
          ? program.weeks[0].sessions
          : program.sessions;

      const currentIdx = allSessions.findIndex((s) => s.order === currentSession.order);
      const nextSession =
        currentIdx >= 0 && currentIdx < allSessions.length - 1
          ? allSessions[currentIdx + 1]
          : allSessions[0];

      const currentLabel = currentSession.sessionName.split("—")[0].trim();
      const nextLabel = nextSession?.sessionName.split("—")[0].trim() ?? currentLabel;

      await prisma.workoutNotification.create({
        data: {
          clientId: params.id,
          workoutLogId: log.id,
          message: `Chúc mừng chị ${client.fullName} đã hoàn thành ${currentLabel} - ${phase}. Buổi tập tiếp theo của chị sẽ là ${nextLabel} - ${phase}`,
          nextSessionName: nextLabel,
          nextSessionPhase: phase,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }
  } catch {
    // Notification creation is non-critical; don't fail the whole request
  }

  return NextResponse.json({
    ...log,
    sessionDate: log.sessionDate.toISOString(),
    createdAt: log.createdAt.toISOString(),
    packageUpdate,
  });
}
