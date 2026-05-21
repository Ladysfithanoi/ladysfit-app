import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const sessionInclude = {
  orderBy: { order: "asc" as const },
  include: { movements: { orderBy: { order: "asc" as const } } },
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string; programId: string; weekId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const week = await prisma.workoutWeek.findUnique({
    where: { id: params.weekId, programId: params.programId },
    include: { sessions: sessionInclude },
  });

  if (!week) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(week);
}

type MovementInput = {
  movementCode: string;
  movementName: string;
  selectedExercise: string;
  sets: number;
  reps: string;
  order: number;
};

type SessionInput = {
  sessionName: string;
  order: number;
  movements: MovementInput[];
};

export async function PUT(
  req: Request,
  { params }: { params: { id: string; programId: string; weekId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { sessions: SessionInput[]; notes?: string };

  const week = await prisma.workoutWeek.findUnique({
    where: { id: params.weekId, programId: params.programId },
    include: { sessions: { include: { movements: true } } },
  });
  if (!week) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Update sessions in-place (matched by `order`) to preserve session IDs.
  // Deleting and recreating sessions would cascade-delete all WorkoutLogs for
  // those sessions, wiping every recorded set/note from previous training dates.
  await prisma.$transaction(async (tx) => {
    const incomingOrders = new Set(body.sessions.map((s) => s.order));

    // Remove sessions that are no longer in the payload
    const toDelete = week.sessions.filter((ws) => !incomingOrders.has(ws.order));
    if (toDelete.length > 0) {
      await tx.workoutSession.deleteMany({
        where: { id: { in: toDelete.map((ws) => ws.id) } },
      });
    }

    for (const s of body.sessions) {
      const existing = week.sessions.find((ws) => ws.order === s.order);

      if (existing) {
        // Keep the same session ID → WorkoutLogs stay intact
        await tx.workoutSession.update({
          where: { id: existing.id },
          data: { sessionName: s.sessionName },
        });
        // Replace only the movement list (movements carry no log history of their own)
        await tx.workoutMovement.deleteMany({ where: { sessionId: existing.id } });
        await tx.workoutMovement.createMany({
          data: s.movements.map((m) => ({ ...m, sessionId: existing.id })),
        });
      } else {
        // Brand-new session — safe to create from scratch
        await tx.workoutSession.create({
          data: {
            programId: params.programId,
            weekId: params.weekId,
            sessionName: s.sessionName,
            order: s.order,
            movements: { create: s.movements },
          },
        });
      }
    }

    if (body.notes !== undefined) {
      await tx.workoutWeek.update({
        where: { id: params.weekId },
        data: { notes: body.notes },
      });
    }
  });

  const updated = await prisma.workoutWeek.findUnique({
    where: { id: params.weekId },
    include: { sessions: sessionInclude },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; programId: string; weekId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the week belongs to this program and client
  const week = await prisma.workoutWeek.findUnique({
    where: { id: params.weekId, programId: params.programId },
    select: { id: true, weekNumber: true, programId: true },
  });
  if (!week) return NextResponse.json({ error: "Không tìm thấy tuần tập" }, { status: 404 });

  // Safety check: must be the highest-numbered week
  const maxWeek = await prisma.workoutWeek.findFirst({
    where: { programId: params.programId },
    orderBy: { weekNumber: "desc" },
    select: { id: true },
  });
  if (maxWeek?.id !== params.weekId) {
    return NextResponse.json({ error: "Chỉ được xóa tuần cao nhất" }, { status: 400 });
  }

  // WorkoutLog, WorkoutSession, WorkoutMovement đều onDelete: Cascade → xóa week là xong
  await prisma.workoutWeek.delete({ where: { id: params.weekId } });

  // Update program's currentWeek if it was pointing to the deleted week
  const remaining = await prisma.workoutWeek.findMany({
    where: { programId: params.programId },
    orderBy: { weekNumber: "desc" },
    select: { weekNumber: true },
  });
  const newCurrentWeek = remaining[0]?.weekNumber ?? 1;
  await prisma.workoutProgram.update({
    where: { id: params.programId },
    data: { currentWeek: newCurrentWeek },
  });

  return NextResponse.json({ deletedWeekId: params.weekId, newCurrentWeek });
}
