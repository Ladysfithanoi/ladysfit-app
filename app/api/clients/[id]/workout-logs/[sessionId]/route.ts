import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { id: string; sessionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.workoutLog.findMany({
    where: { clientId: params.id, sessionId: params.sessionId },
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

// PUT /api/clients/[id]/workout-logs/[logId] — update an existing workout log
export async function PUT(
  req: Request,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const logId = params.sessionId; // dynamic segment reused as logId
    const existing = await prisma.workoutLog.findFirst({
      where: { id: logId, clientId: params.id },
    });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy bản ghi" }, { status: 404 });

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

    const body = await req.json() as { notes?: string | null; setLogs: SetLogInput[] };

    // Update each WorkoutSetLog by id
    await Promise.all(
      body.setLogs.map((sl) =>
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

    // For an in-progress session, stamp the first interaction (server time) the
    // first time any set data is saved — used to enforce the 10-minute rule.
    const hasData = body.setLogs.some((sl) =>
      [
        sl.set1Load, sl.set1Reps, sl.set2Load, sl.set2Reps, sl.set3Load, sl.set3Reps,
        sl.set4Load, sl.set4Reps, sl.set5Load, sl.set5Reps, sl.set6Load, sl.set6Reps,
      ].some((v) => v != null && String(v).trim() !== "")
    );
    const stampInteraction =
      existing.status === "IN_PROGRESS" && existing.firstInteractionAt == null && hasData;

    const updated = await prisma.workoutLog.update({
      where: { id: logId },
      data: {
        notes: body.notes ?? null,
        ...(stampInteraction ? { firstInteractionAt: new Date() } : {}),
      },
      include: {
        setLogs: { orderBy: { id: "asc" } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      ...updated,
      sessionDate: updated.sessionDate.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      checkInAt: updated.checkInAt?.toISOString() ?? null,
      checkOutAt: updated.checkOutAt?.toISOString() ?? null,
      firstInteractionAt: updated.firstInteractionAt?.toISOString() ?? null,
    });
  } catch (error: unknown) {
    const e = error as { message?: string };
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/clients/[id]/workout-logs/[logId] — remove a workout log.
// Active logs (IN_PROGRESS / AWAITING_CONFIRMATION) were never counted, so they
// just vanish. A COMPLETED log was counted via incrementPackageAndNotify, so we
// reverse that here: decrement the package's sessionsUsed and re-open it if it
// had been auto-completed. Re-recording the session later counts it again.
// Set logs cascade-delete with the log.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const logId = params.sessionId; // dynamic segment reused as logId
    const existing = await prisma.workoutLog.findFirst({
      where: { id: logId, clientId: params.id },
    });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy bản ghi" }, { status: 404 });

    let packageUpdate: {
      id: string; sessionsUsed: number; sessions: number; packageName: string; status: string;
    } | null = null;

    // Reverse the session count for a completed log.
    if (existing.status === "COMPLETED") {
      const pkg = await prisma.packageEnrollment.findFirst({
        where: { clientId: params.id, status: { in: ["ACTIVE", "COMPLETED"] }, sessionsUsed: { gt: 0 } },
        orderBy: { createdAt: "desc" },
      });
      if (pkg) {
        const updated = await prisma.packageEnrollment.update({
          where: { id: pkg.id },
          data: { sessionsUsed: pkg.sessionsUsed - 1, status: "ACTIVE" },
        });
        packageUpdate = {
          id: updated.id,
          sessionsUsed: updated.sessionsUsed,
          sessions: updated.sessions,
          packageName: updated.packageName,
          status: updated.status,
        };
      }
    }

    await prisma.workoutLog.delete({ where: { id: logId } });
    return NextResponse.json({ ok: true, deletedId: logId, packageUpdate });
  } catch (error: unknown) {
    const e = error as { message?: string };
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
