import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSlotsForSessionType } from "@/lib/workout-structure";

const fullProgramInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  packageEnrollment: { select: { id: true, packageName: true } },
  weeks: {
    orderBy: { weekNumber: "asc" as const },
    include: {
      sessions: {
        orderBy: { order: "asc" as const },
        include: { movements: { orderBy: { order: "asc" as const } } },
      },
    },
  },
  sessions: {
    where: { weekId: null as null },
    orderBy: { order: "asc" as const },
    include: { movements: { orderBy: { order: "asc" as const } } },
  },
};

export async function GET(
  req: Request,
  { params }: { params: { id: string; programId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const program = await prisma.workoutProgram.findUnique({
    where: { id: params.programId, clientId: params.id },
    include: fullProgramInclude,
  });

  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(program);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; programId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    status?: string;
    notes?: string | null;
    phase?: string;
    phaseId?: string | null;
    sessionsPerWeek?: number;
    currentWeek?: number;
    workoutType?: string | null;
  };

  // Update program metadata fields
  await prisma.workoutProgram.update({
    where: { id: params.programId, clientId: params.id },
    data: {
      ...(body.status === "ARCHIVED" || body.status === "ACTIVE" ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.phase !== undefined ? { phase: body.phase } : {}),
      ...(body.phaseId !== undefined ? { phaseId: body.phaseId } : {}),
      ...(body.sessionsPerWeek !== undefined ? { sessionsPerWeek: body.sessionsPerWeek } : {}),
      ...(body.currentWeek !== undefined ? { currentWeek: body.currentWeek } : {}),
      ...(body.workoutType !== undefined ? { workoutType: body.workoutType } : {}),
    },
  });

  // Sync session count across all weeks when sessionsPerWeek changes
  if (body.sessionsPerWeek !== undefined) {
    const prog = await prisma.workoutProgram.findUnique({
      where: { id: params.programId },
      include: {
        workoutPhase: true,
        weeks: {
          orderBy: { weekNumber: "asc" },
          include: { sessions: { orderBy: { order: "asc" } } },
        },
      },
    });

    if (prog && prog.weeks.length > 0) {
      const newCount = body.sessionsPerWeek;
      const phaseData = prog.workoutPhase;
      const sessionTypes = phaseData?.sessionTypes ?? [];
      const templateKey = phaseData?.templateKey ?? "";

      for (const week of prog.weeks) {
        const currentCount = week.sessions.length;

        if (newCount > currentCount) {
          for (let i = currentCount; i < newCount; i++) {
            const sessionType =
              sessionTypes.length > 0 ? sessionTypes[i % sessionTypes.length] : "Tạ 1";
            const slots = getSlotsForSessionType(sessionType, templateKey || undefined);
            await prisma.workoutSession.create({
              data: {
                programId: params.programId,
                weekId: week.id,
                sessionName: `Buổi ${String.fromCharCode(65 + i)} — ${sessionType}`,
                order: i,
                movements: {
                  create: slots.map((slot, mi) => ({
                    movementCode: slot.code,
                    movementName: slot.name,
                    selectedExercise: "",
                    sets: slot.defaultSets,
                    reps: slot.defaultReps,
                    order: mi,
                  })),
                },
              },
            });
          }
        } else if (newCount < currentCount) {
          const toDelete = week.sessions.slice(newCount).map((s) => s.id);
          if (toDelete.length > 0) {
            await prisma.workoutSession.deleteMany({ where: { id: { in: toDelete } } });
          }
        }
      }
    }
  }

  // Return the full updated program so the frontend can sync weeks/sessions
  const program = await prisma.workoutProgram.findUnique({
    where: { id: params.programId },
    include: fullProgramInclude,
  });

  return NextResponse.json(program);
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; programId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.workoutProgram.delete({
    where: { id: params.programId, clientId: params.id },
  });

  return NextResponse.json({ ok: true });
}
