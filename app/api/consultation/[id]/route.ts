import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const c = await prisma.consultation.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true, email: true, branchId: true } },
      branch: { select: { id: true, name: true } },
      info: true,
      assessment: true,
      packages: { orderBy: { order: "asc" } },
    },
  });

  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && c.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(c);
}

type WDMovement = {
  movementCode: string; movementName: string; selectedExercise: string;
  customExercise?: string; sets: number; reps: string; order?: number;
};
type WDSession = { key: string; sessionType: string; movements: WDMovement[] };
type WorkoutDesignBody = {
  phase: string; workoutType: string; sessionsPerWeek: number;
  startWeek: number; sessions: WDSession[];
};

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { step, info, assessment, packages, status, createdById, branchId, workoutDesign } = body;

  const c = await prisma.consultation.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && c.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update top-level consultation fields
  await prisma.consultation.update({
    where: { id: params.id },
    data: {
      ...(step != null ? { currentStep: step } : {}),
      ...(status ? { status } : {}),
      ...(createdById ? { createdById } : {}),
      ...(branchId ? { branchId } : {}),
      ...(workoutDesign !== undefined
        ? { workoutDesignJson: workoutDesign ? JSON.stringify(workoutDesign) : null }
        : {}),
    },
  });

  // When workout design is explicitly saved (Step 3 "Lưu & Tiếp tục"),
  // create the WorkoutProgram immediately so it survives any completion-flow issues.
  if (workoutDesign !== undefined) {
    // Remove any pre-existing unlinked program for this consultation
    await prisma.workoutProgram.deleteMany({
      where: { consultationId: params.id, clientId: null },
    });

    if (workoutDesign) {
      const design = workoutDesign as WorkoutDesignBody;
      const startWeek = design.startWeek ?? 1;

      const program = await prisma.workoutProgram.create({
        data: {
          consultationId: params.id,
          createdById: c.createdById,
          phase: design.phase,
          workoutType: design.workoutType,
          sessionsPerWeek: design.sessionsPerWeek,
          currentWeek: startWeek,
        },
      });

      const week = await prisma.workoutWeek.create({
        data: { programId: program.id, weekNumber: startWeek },
      });

      for (let i = 0; i < (design.sessions ?? []).length; i++) {
        const s = design.sessions[i];
        await prisma.workoutSession.create({
          data: {
            programId: program.id,
            weekId: week.id,
            sessionName: `Buổi ${s.key} — ${s.sessionType}`,
            order: i,
            movements: {
              create: s.movements.map((m, mi) => ({
                movementCode: m.movementCode,
                movementName: m.movementName,
                selectedExercise:
                  m.selectedExercise === "__custom__" ? (m.customExercise ?? "") : m.selectedExercise,
                sets: m.sets,
                reps: m.reps,
                order: mi,
              })),
            },
          },
        });
      }
    }
  }

  // Upsert info (step 1)
  if (info) {
    await prisma.consultationInfo.upsert({
      where: { consultationId: params.id },
      create: { consultationId: params.id, ...info },
      update: info,
    });
  }

  // Upsert assessment (step 2)
  if (assessment) {
    await prisma.consultationAssessment.upsert({
      where: { consultationId: params.id },
      create: { consultationId: params.id, ...assessment },
      update: assessment,
    });
  }

  // Replace packages (step 5)
  if (packages) {
    await prisma.consultationPackage.deleteMany({ where: { consultationId: params.id } });
    if (packages.length > 0) {
      await prisma.consultationPackage.createMany({
        data: packages.map((p: Record<string, unknown>) => ({ ...p, consultationId: params.id })),
      });
    }
  }

  const updated = await prisma.consultation.findUnique({
    where: { id: params.id },
    include: { info: true, assessment: true, packages: { orderBy: { order: "asc" } } },
  });

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { workoutDesignJson, ...rest } = updated;
  return NextResponse.json({
    ...rest,
    workoutDesign: workoutDesignJson ? JSON.parse(workoutDesignJson) : null,
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const c = await prisma.consultation.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];
  const isFMManaged = isFM && managedBranchIds.includes(c.branchId);

  if (!isAdmin && !isFMManaged && c.createdById !== session.user.id) {
    return NextResponse.json({ error: "Bạn không có quyền xóa hồ sơ này" }, { status: 403 });
  }

  await prisma.consultation.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
