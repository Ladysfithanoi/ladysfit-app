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

  // Delete all existing sessions for this week
  await prisma.workoutSession.deleteMany({ where: { weekId: params.weekId } });

  // Recreate sessions
  for (const s of body.sessions) {
    await prisma.workoutSession.create({
      data: {
        programId: params.programId,
        weekId: params.weekId,
        sessionName: s.sessionName,
        order: s.order,
        movements: { create: s.movements },
      },
    });
  }

  if (body.notes !== undefined) {
    await prisma.workoutWeek.update({
      where: { id: params.weekId },
      data: { notes: body.notes },
    });
  }

  const updated = await prisma.workoutWeek.findUnique({
    where: { id: params.weekId },
    include: { sessions: sessionInclude },
  });

  return NextResponse.json(updated);
}
