import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const c = await prisma.consultation.findUnique({
    where: { id: params.id },
    include: {
      info: true,
      assessment: true,
      packages: { where: { isConfirmed: true }, orderBy: { order: "asc" } },
    },
  });

  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!c.info) return NextResponse.json({ error: "Chưa có thông tin khách hàng (bước 1)" }, { status: 400 });
  if (!c.info.fullName || !c.info.phone) {
    return NextResponse.json({ error: "Họ tên và số điện thoại là bắt buộc" }, { status: 400 });
  }

  const info = c.info;

  const count = await prisma.client.count();
  const clientCode = `LDF${String(count + 1).padStart(4, "0")}`;

  const client = await prisma.client.create({
    data: {
      clientCode,
      fullName: info.fullName,
      phone: info.phone,
      email: info.email || null,
      dateOfBirth: info.dateOfBirth || null,
      initialWeight: info.currentWeight || 0,
      currentWeight: info.currentWeight || 0,
      targetWeight: info.targetWeight || 0,
      height: info.height || 0,
      initialWaist: c.assessment?.waist || null,
      initialHip: c.assessment?.hip || null,
      healthConditions: info.healthConditions || null,
      injuries: info.injuries || null,
      assignedPTId: c.createdById,
      branchId: c.branchId,
      status: "ACTIVE",
    },
  });

  await prisma.consultation.update({
    where: { id: params.id },
    data: { status: "COMPLETED", convertedClientId: client.id },
  });

  // Append completion note to linked SalesLead
  const linkedLead = await prisma.salesLead.findUnique({ where: { consultationId: params.id } });
  if (linkedLead) {
    const dateStr = new Date().toLocaleDateString("vi-VN");
    const suffix = `\nĐã hoàn thành tư vấn - ${dateStr}`;
    await prisma.salesLead.update({
      where: { id: linkedLead.id },
      data: { notes: linkedLead.notes ? linkedLead.notes + suffix : suffix.trim() },
    });
  }

  if (c.packages.length > 0) {
    const year = new Date().getFullYear();
    const yearStart = new Date(`${year}-01-01`);
    const baseCount = await prisma.packageEnrollment.count({ where: { createdAt: { gte: yearStart } } });
    await prisma.packageEnrollment.createMany({
      data: c.packages.map((pkg, i) => ({
        clientId: client.id,
        packageName: pkg.packageName,
        packageStage: pkg.packageStage,
        sessions: pkg.sessions,
        sessionsUsed: 0,
        durationDays: pkg.durationDays,
        price: pkg.discountedPrice ?? pkg.price,
        contractCode: `HDLDF${year}${String(baseCount + i + 1).padStart(4, "0")}`,
        status: "ACTIVE" as const,
      })),
    });
  }

  // Link pre-created workout programs from Step 3 to the new client
  const linked = await prisma.workoutProgram.updateMany({
    where: { consultationId: params.id },
    data: { clientId: client.id },
  });

  // Fallback: create from workoutDesignJson for consultations that used the old flow
  if (linked.count === 0 && c.workoutDesignJson) {
    type DraftMovement = {
      movementCode: string; movementName: string; selectedExercise: string;
      customExercise?: string; sets: number; reps: string;
    };
    type DraftSession = { key: string; sessionType: string; movements: DraftMovement[] };
    type WorkoutDesign = {
      phase: string; workoutType: string; sessionsPerWeek: number;
      startWeek: number; sessions: DraftSession[];
    };

    try {
      const design = JSON.parse(c.workoutDesignJson) as WorkoutDesign;
      const startWeek = design.startWeek ?? 1;

      const program = await prisma.workoutProgram.create({
        data: {
          clientId: client.id,
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

      for (let i = 0; i < design.sessions.length; i++) {
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
                  m.selectedExercise === "__custom__"
                    ? (m.customExercise ?? "")
                    : m.selectedExercise,
                sets: m.sets,
                reps: m.reps,
                order: mi,
              })),
            },
          },
        });
      }
    } catch (err) {
      console.error("[complete] Failed to create workout program from JSON:", err);
    }
  }

  // Link pre-created meal plan from Step 4 to the new client
  await prisma.mealPlan.updateMany({
    where: { consultationId: params.id, clientId: null },
    data: { clientId: client.id },
  });

  return NextResponse.json({ clientId: client.id });
}
