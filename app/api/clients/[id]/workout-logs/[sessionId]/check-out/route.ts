import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INTERACTION_WINDOW_MS = 10 * 60 * 1000; // must interact within 10 min of check-in

type SetLogInput = {
  id: string;
  set1Load?: string | null; set1Reps?: string | null;
  set2Load?: string | null; set2Reps?: string | null;
  set3Load?: string | null; set3Reps?: string | null;
  set4Load?: string | null; set4Reps?: string | null;
  set5Load?: string | null; set5Reps?: string | null;
  set6Load?: string | null; set6Reps?: string | null;
  exerciseNotes?: string | null;
};

function hasData(sl: SetLogInput): boolean {
  return [
    sl.set1Load, sl.set1Reps, sl.set2Load, sl.set2Reps, sl.set3Load, sl.set3Reps,
    sl.set4Load, sl.set4Reps, sl.set5Load, sl.set5Reps, sl.set6Load, sl.set6Reps,
  ].some((v) => v != null && String(v).trim() !== "");
}

// POST /api/clients/[id]/workout-logs/[logId]/check-out
// Finalizes an in-progress session. Validates the anti-cheat rules and either
// completes the session (incrementing sessionsUsed) or voids it.
export async function POST(
  req: Request,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const logId = params.sessionId; // dynamic segment reused as logId
    const log = await prisma.workoutLog.findFirst({
      where: { id: logId, clientId: params.id },
    });
    if (!log) return NextResponse.json({ error: "Không tìm thấy bản ghi" }, { status: 404 });
    if (log.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Buổi tập này đã được kết thúc" }, { status: 400 });
    }
    if (!log.checkInAt) {
      return NextResponse.json({ error: "Buổi tập thiếu thời điểm check-in" }, { status: 400 });
    }

    const body = (await req.json()) as {
      signatureUrl?: string | null;
      notes?: string | null;
      setLogs?: SetLogInput[];
    };

    const setLogs = body.setLogs ?? [];

    // Persist the latest set data.
    if (setLogs.length > 0) {
      await Promise.all(
        setLogs.map((sl) =>
          prisma.workoutSetLog.update({
            where: { id: sl.id },
            data: {
              set1Load: sl.set1Load != null ? String(sl.set1Load) : null,
              set1Reps: sl.set1Reps != null ? String(sl.set1Reps) : null,
              set2Load: sl.set2Load != null ? String(sl.set2Load) : null,
              set2Reps: sl.set2Reps != null ? String(sl.set2Reps) : null,
              set3Load: sl.set3Load != null ? String(sl.set3Load) : null,
              set3Reps: sl.set3Reps != null ? String(sl.set3Reps) : null,
              set4Load: sl.set4Load != null ? String(sl.set4Load) : null,
              set4Reps: sl.set4Reps != null ? String(sl.set4Reps) : null,
              set5Load: sl.set5Load != null ? String(sl.set5Load) : null,
              set5Reps: sl.set5Reps != null ? String(sl.set5Reps) : null,
              set6Load: sl.set6Load != null ? String(sl.set6Load) : null,
              set6Reps: sl.set6Reps != null ? String(sl.set6Reps) : null,
              exerciseNotes: sl.exerciseNotes ?? null,
            },
          })
        )
      );
    }

    const now = new Date();

    // Stamp first interaction (server time) if data exists and it's not set yet.
    let firstInteractionAt = log.firstInteractionAt;
    if (!firstInteractionAt && setLogs.some(hasData)) {
      firstInteractionAt = now;
    }

    const interactionOk =
      firstInteractionAt != null &&
      firstInteractionAt.getTime() - log.checkInAt.getTime() <= INTERACTION_WINDOW_MS;

    const sig = (body.signatureUrl ?? "").trim();

    // ── Rule 1: no interaction within 10 min → the session can never count. Void it. ──
    if (!interactionOk) {
      const voided = await prisma.workoutLog.update({
        where: { id: logId },
        data: {
          status: "VOID",
          checkOutAt: now,
          firstInteractionAt,
          signatureUrl: sig || null,
          notes: body.notes ?? log.notes,
          voidReason: "Không có tương tác (nhập số liệu) trong 10 phút đầu",
        },
        include: {
          setLogs: { orderBy: { id: "asc" } },
          createdBy: { select: { id: true, name: true } },
        },
      });
      return NextResponse.json({
        ...serialize(voided),
        valid: false,
        reason: voided.voidReason,
        packageUpdate: null,
      });
    }

    // ── Rule 2: minimum duration (configurable) ──
    const config = await prisma.systemConfig.findUnique({ where: { id: "main" } });
    const minMinutes = config?.minSessionMinutes ?? 30;
    const elapsedMin = (now.getTime() - log.checkInAt.getTime()) / 60000;
    if (elapsedMin < minMinutes) {
      // Keep IN_PROGRESS so the PT can continue and finalize later.
      if (firstInteractionAt && firstInteractionAt !== log.firstInteractionAt) {
        await prisma.workoutLog.update({ where: { id: logId }, data: { firstInteractionAt } });
      }
      return NextResponse.json(
        {
          error: `Buổi tập mới được ${Math.floor(elapsedMin)} phút, cần tối thiểu ${minMinutes} phút mới có thể xác nhận.`,
        },
        { status: 400 }
      );
    }

    // ── Rule 3: signature required ──
    if (!sig) {
      if (firstInteractionAt && firstInteractionAt !== log.firstInteractionAt) {
        await prisma.workoutLog.update({ where: { id: logId }, data: { firstInteractionAt } });
      }
      return NextResponse.json({ error: "Cần chữ ký xác nhận của khách hàng" }, { status: 400 });
    }

    // ── All rules passed → complete the session ──
    const completed = await prisma.workoutLog.update({
      where: { id: logId },
      data: {
        status: "COMPLETED",
        checkOutAt: now,
        firstInteractionAt,
        signatureUrl: sig,
        notes: body.notes ?? log.notes,
      },
      include: {
        setLogs: { orderBy: { id: "asc" } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Increment sessionsUsed on the active package enrollment.
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

    // Completion notification for the client (non-critical).
    try {
      const [client, currentSession, program] = await Promise.all([
        prisma.client.findUnique({ where: { id: params.id }, select: { fullName: true } }),
        prisma.workoutSession.findUnique({ where: { id: log.sessionId }, select: { sessionName: true, order: true } }),
        prisma.workoutProgram.findUnique({
          where: { id: log.programId },
          select: {
            phase: true,
            workoutType: true,
            weeks: {
              where: { id: log.weekId },
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
        const allSessions = program.weeks[0]?.sessions.length
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
            workoutLogId: completed.id,
            message: `Chúc mừng chị ${client.fullName} đã hoàn thành ${currentLabel} - ${phase}. Buổi tập tiếp theo của chị sẽ là ${nextLabel} - ${phase}`,
            nextSessionName: nextLabel,
            nextSessionPhase: phase,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      ...serialize(completed),
      valid: true,
      packageUpdate,
    });
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[workout-logs check-out]", e.message);
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
