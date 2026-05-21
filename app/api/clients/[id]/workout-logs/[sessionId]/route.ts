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
      set1Load?: string | null; set1Reps?: number | null;
      set2Load?: string | null; set2Reps?: number | null;
      set3Load?: string | null; set3Reps?: number | null;
      set4Load?: string | null; set4Reps?: number | null;
      set5Load?: string | null; set5Reps?: number | null;
      set6Load?: string | null; set6Reps?: number | null;
      exerciseNotes?: string | null;
    };

    const body = await req.json() as { notes?: string | null; setLogs: SetLogInput[] };

    // Update each WorkoutSetLog by id
    await Promise.all(
      body.setLogs.map((sl) =>
        prisma.workoutSetLog.update({
          where: { id: sl.id },
          data: {
            set1Load: sl.set1Load ?? null, set1Reps: sl.set1Reps ?? null,
            set2Load: sl.set2Load ?? null, set2Reps: sl.set2Reps ?? null,
            set3Load: sl.set3Load ?? null, set3Reps: sl.set3Reps ?? null,
            set4Load: sl.set4Load ?? null, set4Reps: sl.set4Reps ?? null,
            set5Load: sl.set5Load ?? null, set5Reps: sl.set5Reps ?? null,
            set6Load: sl.set6Load ?? null, set6Reps: sl.set6Reps ?? null,
            exerciseNotes: sl.exerciseNotes ?? null,
          },
        })
      )
    );

    const updated = await prisma.workoutLog.update({
      where: { id: logId },
      data: { notes: body.notes ?? null },
      include: {
        setLogs: { orderBy: { id: "asc" } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      ...updated,
      sessionDate: updated.sessionDate.toISOString(),
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error: unknown) {
    const e = error as { message?: string };
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
