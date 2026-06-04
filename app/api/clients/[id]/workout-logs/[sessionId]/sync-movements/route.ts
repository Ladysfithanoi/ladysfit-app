import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/clients/[id]/workout-logs/[logId]/sync-movements
// Reconcile an IN_PROGRESS log's set-log rows with the session's CURRENT movements.
// Editing a program deletes + recreates WorkoutMovement rows (their ids change and
// the set log's movementId is nulled), so we match by movementName. Entered data is
// always preserved:
//   - movement still in program  → keep the row, refresh exerciseName, relink movementId
//   - movement added to program  → create a new empty row
//   - movement removed: empty row → delete it; row with data → keep it (don't lose numbers)

const SET_FIELDS = [
  "set1Load", "set1Reps", "set2Load", "set2Reps", "set3Load", "set3Reps",
  "set4Load", "set4Reps", "set5Load", "set5Reps", "set6Load", "set6Reps",
] as const;

type SetLogRow = Record<string, unknown> & { exerciseNotes?: string | null };

function rowHasData(sl: SetLogRow): boolean {
  return (
    SET_FIELDS.some((f) => sl[f] != null && String(sl[f]).trim() !== "") ||
    (sl.exerciseNotes != null && String(sl.exerciseNotes).trim() !== "")
  );
}

const INCLUDE = {
  setLogs: { orderBy: { id: "asc" as const } },
  createdBy: { select: { id: true, name: true } },
} as const;

export async function POST(
  _req: Request,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const logId = params.sessionId; // dynamic segment reused as logId
    const log = await prisma.workoutLog.findFirst({
      where: { id: logId, clientId: params.id },
      include: { setLogs: { orderBy: { id: "asc" } } },
    });
    if (!log) return NextResponse.json({ error: "Không tìm thấy bản ghi" }, { status: 404 });
    if (log.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Chỉ cập nhật được buổi tập đang diễn ra" }, { status: 400 });
    }

    const workoutSession = await prisma.workoutSession.findUnique({
      where: { id: log.sessionId },
      include: { movements: { orderBy: { order: "asc" } } },
    });
    if (!workoutSession) {
      return NextResponse.json({ error: "Không tìm thấy buổi tập" }, { status: 404 });
    }

    const existing = log.setLogs;
    const used = new Set<string>();
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    // Match each current movement to the first unused existing row with the same name.
    for (const m of workoutSession.movements) {
      const match = existing.find((sl) => !used.has(sl.id) && sl.movementName === m.movementName);
      if (match) {
        used.add(match.id);
        if (match.exerciseName !== m.selectedExercise || match.movementId !== m.id) {
          ops.push(
            prisma.workoutSetLog.update({
              where: { id: match.id },
              data: { exerciseName: m.selectedExercise, movementId: m.id },
            })
          );
        }
      } else {
        ops.push(
          prisma.workoutSetLog.create({
            data: {
              workoutLogId: log.id,
              movementId: m.id,
              movementName: m.movementName,
              exerciseName: m.selectedExercise,
            },
          })
        );
      }
    }

    // Drop leftover empty rows for movements no longer in the program; keep rows with data.
    for (const sl of existing) {
      if (used.has(sl.id)) continue;
      if (!rowHasData(sl as SetLogRow)) {
        ops.push(prisma.workoutSetLog.delete({ where: { id: sl.id } }));
      }
    }

    if (ops.length > 0) await prisma.$transaction(ops);

    const updated = await prisma.workoutLog.findUniqueOrThrow({
      where: { id: log.id },
      include: INCLUDE,
    });

    // Order rows to match the current program; kept-but-removed rows go last.
    const orderIndex = new Map<string, number>();
    workoutSession.movements.forEach((m, i) => {
      if (!orderIndex.has(m.movementName)) orderIndex.set(m.movementName, i);
    });
    const sortedSetLogs = [...updated.setLogs].sort((a, b) => {
      const ai = orderIndex.get(a.movementName) ?? Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.get(b.movementName) ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.id < b.id ? -1 : 1;
    });

    return NextResponse.json({
      ...updated,
      setLogs: sortedSetLogs,
      sessionDate: updated.sessionDate.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      checkInAt: updated.checkInAt?.toISOString() ?? null,
      checkOutAt: updated.checkOutAt?.toISOString() ?? null,
      firstInteractionAt: updated.firstInteractionAt?.toISOString() ?? null,
    });
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[workout-logs sync-movements]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
