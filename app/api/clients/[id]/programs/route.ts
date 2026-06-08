import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSlotsForSessionType } from "@/lib/workout-structure";

const weekInclude = {
  orderBy: { weekNumber: "asc" as const },
  include: {
    sessions: {
      orderBy: { order: "asc" as const },
      include: { movements: { orderBy: { order: "asc" as const } } },
    },
  },
};

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const programs = await prisma.workoutProgram.findMany({
    where: { clientId: params.id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      packageEnrollment: { select: { id: true, packageName: true } },
      weeks: weekInclude,
      sessions: {
        where: { weekId: null },
        orderBy: { order: "asc" },
        include: { movements: { orderBy: { order: "asc" } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(programs);
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

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    phase: string;
    phaseId?: string;
    workoutType?: string;
    sessionsPerWeek: number;
    currentWeek?: number;
    packageEnrollmentId?: string;
    notes?: string;
    sessions?: SessionInput[];
  };

  const startWeek = body.currentWeek ?? 1;

  const program = await prisma.workoutProgram.create({
    data: {
      clientId: params.id,
      createdById: session.user.id,
      phase: body.phase,
      phaseId: body.phaseId || null,
      workoutType: body.workoutType || null,
      sessionsPerWeek: body.sessionsPerWeek,
      currentWeek: startWeek,
      packageEnrollmentId: body.packageEnrollmentId || null,
      notes: body.notes || null,
    },
  });

  const week = await prisma.workoutWeek.create({
    data: { programId: program.id, weekNumber: startWeek },
  });

  let sessions: SessionInput[] = body.sessions ?? [];

  // Auto-generate sessions from phase template when none are provided
  if (sessions.length === 0 && body.phaseId) {
    const phaseData = await prisma.workoutPhase.findUnique({ where: { id: body.phaseId } });
    if (phaseData) {
      sessions = Array.from({ length: body.sessionsPerWeek }, (_, i) => {
        const sessionType =
          phaseData.sessionTypes.length > 0
            ? phaseData.sessionTypes[i % phaseData.sessionTypes.length]
            : "Tạ 1";
        const slots = getSlotsForSessionType(sessionType, phaseData.templateKey || undefined);
        return {
          sessionName: `Buổi ${i + 1} — ${sessionType}`,
          order: i,
          movements: slots.map((slot, mi) => ({
            movementCode: slot.code,
            movementName: slot.name,
            selectedExercise: "",
            sets: slot.defaultSets,
            reps: slot.defaultReps,
            order: mi,
          })),
        };
      });
    }
  }

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const type = s.sessionName.includes("—")
      ? s.sessionName.split("—").slice(1).join("—").trim()
      : "";
    await prisma.workoutSession.create({
      data: {
        programId: program.id,
        weekId: week.id,
        sessionName: type ? `Buổi ${i + 1} — ${type}` : `Buổi ${i + 1}`,
        order: s.order,
        movements: { create: s.movements },
      },
    });
  }

  const created = await prisma.workoutProgram.findUnique({
    where: { id: program.id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      packageEnrollment: { select: { id: true, packageName: true } },
      weeks: weekInclude,
      sessions: { where: { weekId: null }, orderBy: { order: "asc" }, include: { movements: { orderBy: { order: "asc" } } } },
    },
  });

  return NextResponse.json(created, { status: 201 });
}
