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
  { params }: { params: { id: string; programId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const weeks = await prisma.workoutWeek.findMany({
    where: { programId: params.programId },
    orderBy: { weekNumber: "asc" },
    include: { sessions: sessionInclude },
  });

  return NextResponse.json(weeks);
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string; programId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const program = await prisma.workoutProgram.findUnique({
    where: { id: params.programId, clientId: params.id },
    include: {
      weeks: {
        orderBy: { weekNumber: "desc" },
        take: 1,
        include: { sessions: sessionInclude },
      },
    },
  });

  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lastWeek = program.weeks[0];
  const newWeekNumber = lastWeek ? lastWeek.weekNumber + 1 : 1;

  const newWeek = await prisma.workoutWeek.create({
    data: { programId: params.programId, weekNumber: newWeekNumber },
  });

  // Copy sessions from previous week
  if (lastWeek) {
    for (const s of lastWeek.sessions) {
      await prisma.workoutSession.create({
        data: {
          programId: params.programId,
          weekId: newWeek.id,
          sessionName: s.sessionName,
          order: s.order,
          movements: {
            create: s.movements.map((m) => ({
              movementCode: m.movementCode,
              movementName: m.movementName,
              selectedExercise: m.selectedExercise,
              sets: m.sets,
              reps: m.reps,
              order: m.order,
            })),
          },
        },
      });
    }
  }

  // Update program currentWeek
  await prisma.workoutProgram.update({
    where: { id: params.programId },
    data: { currentWeek: newWeekNumber },
  });

  const created = await prisma.workoutWeek.findUnique({
    where: { id: newWeek.id },
    include: { sessions: sessionInclude },
  });

  return NextResponse.json({ week: created, currentWeek: newWeekNumber }, { status: 201 });
}
