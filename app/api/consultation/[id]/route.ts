import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format-date";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
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
  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFMManaged = role === "FM" && (session.user.managedBranchIds ?? []).includes(c.branchId);
  if (!isAdmin && !isFMManaged && c.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(c);
  } catch (error: unknown) {
    const e = error as { message?: string; code?: string };
    console.error("[consultation/[id] GET]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
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
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { step, info, assessment, packages, status, createdById, branchId, workoutDesign } = body;

  const c = await prisma.consultation.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFMManaged = role === "FM" && (session.user.managedBranchIds ?? []).includes(c.branchId);
  if (!isAdmin && !isFMManaged && c.createdById !== session.user.id) {
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

    // Auto-create or link SalesLead for this consultation.
    // IMPORTANT: use `createdById` / `branchId` from the request body (the values
    // the wizard just sent) rather than `c.createdById` / `c.branchId` (stale,
    // fetched before the update above). When an FM fills Step 1, the body contains
    // the *selected PT's* ID in `createdById` — c.createdById is still the FM.
    const assignedPTId = (createdById as string | undefined) || c.createdById;
    const effectiveBranchId = (branchId as string | undefined) || c.branchId;

    const infoData = info as {
      fullName?: string;
      phone?: string;
      dateOfBirth?: string | null;
      knowLDFVia?: string | null;
      referralSource?: string | null;
    };
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const customerName = infoData.fullName?.trim() || "—";
    const phone = infoData.phone?.trim() || null;
    const yearOfBirth = infoData.dateOfBirth ? new Date(infoData.dateOfBirth).getFullYear() : null;
    const source = infoData.knowLDFVia?.trim() || null;
    const referralSource = source === "Referral" ? (infoData.referralSource?.trim() || null) : null;

    const linkedLead = await prisma.salesLead.findUnique({ where: { consultationId: params.id } });

    if (linkedLead) {
      // Update basic info (and correct a previously wrong assignedPTId) on re-save
      await prisma.salesLead.update({
        where: { id: linkedLead.id },
        data: {
          assignedPTId,
          branchId: effectiveBranchId,
          customerName,
          ...(yearOfBirth != null ? { yearOfBirth } : {}),
          ...(phone != null ? { phone } : {}),
          ...(source != null ? { source, referralSource } : {}),
        },
      });
    } else {
      // Check for a manually-created lead with the same phone this month (avoid duplicate)
      const existingByPhone = phone
        ? await prisma.salesLead.findFirst({
            where: { phone, assignedPTId, branchId: effectiveBranchId, month: currentMonth, year: currentYear, consultationId: null },
          })
        : null;

      if (existingByPhone) {
        await prisma.salesLead.update({ where: { id: existingByPhone.id }, data: { consultationId: params.id } });
      } else {
        await prisma.salesLead.create({
          data: {
            branchId: effectiveBranchId,
            assignedPTId,
            createdById: session.user.id,
            customerName,
            yearOfBirth,
            phone,
            source,
            referralSource,
            notes: `[Từ tư vấn ${fmtDate(now)}]`,
            status: "TAKECARE",
            month: currentMonth,
            year: currentYear,
            consultationId: params.id,
          },
        });
      }
    }
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
  } catch (error: unknown) {
    const e = error as { message?: string; code?: string };
    console.error("[consultation/[id] PUT]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
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
  } catch (error: unknown) {
    const e = error as { message?: string; code?: string };
    console.error("[consultation/[id] DELETE]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
