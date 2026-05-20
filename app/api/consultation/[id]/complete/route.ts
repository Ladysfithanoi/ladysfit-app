import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
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

  // Idempotency: if already completed, skip client creation and return existing clientId
  if (c.convertedClientId) {
    return NextResponse.json({ clientId: c.convertedClientId });
  }

  if (!c.info) return NextResponse.json({ error: "Chưa có thông tin khách hàng (bước 1)" }, { status: 400 });
  if (!c.info.fullName || !c.info.phone) {
    return NextResponse.json({ error: "Họ tên và số điện thoại là bắt buộc" }, { status: 400 });
  }

  const info = c.info;

  // Generate clientCode based on MAX existing code (not count) to survive gaps from deletions.
  // Find the highest numeric suffix among all clientCodes and increment it.
  const nextClientCode = async (): Promise<string> => {
    const last = await prisma.client.findFirst({
      where: { clientCode: { not: null } },
      orderBy: { clientCode: "desc" },
      select: { clientCode: true },
    });
    const match = last?.clientCode?.match(/(\d+)$/);
    const nextNum = match ? parseInt(match[1]) + 1 : 1;
    return `LDF${String(nextNum).padStart(4, "0")}`;
  };

  const emailToUse: string | null = info.email?.trim() || null;
  let client: { id: string } | null = null;

  const makeClientData = (clientCode: string, email: string | null) => ({
    clientCode,
    fullName: info.fullName,
    phone: info.phone,
    email,
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
    status: "ACTIVE" as const,
  });

  // Try with email first; if email conflicts, retry without email so the client is always created.
  // Two passes: pass 0 = with email, pass 1 = without email (only reached on email conflict).
  const emailCandidates: Array<string | null> = emailToUse ? [emailToUse, null] : [null];

  for (const candidateEmail of emailCandidates) {
    let created = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const baseCode = await nextClientCode();
      const baseNum = parseInt(baseCode.replace("LDF", "")) + attempt;
      const clientCode = `LDF${String(baseNum).padStart(4, "0")}`;
      try {
        client = await prisma.client.create({ data: makeClientData(clientCode, candidateEmail) });
        created = true;
        break;
      } catch (err: unknown) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") throw err;

        const rawTarget = err.meta?.target;
        const targets: string[] = Array.isArray(rawTarget)
          ? (rawTarget as string[])
          : typeof rawTarget === "string" ? [rawTarget] : [];
        const onClientCode = targets.some((t) => /clientcode|client_code/i.test(t));

        if (!onClientCode && candidateEmail) break; // email conflict → outer loop will retry without email
        if (onClientCode && attempt < 4) continue;  // clientCode collision → bump and retry
        throw err; // exhausted retries or unknown field
      }
    }
    if (created) break;
  }

  if (!client) throw new Error("Không thể tạo mã khách hàng sau nhiều lần thử");

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
      phaseId?: string; phase: string; workoutType: string; sessionsPerWeek: number;
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
          phaseId: design.phaseId || null,
          workoutType: design.workoutType || null,
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
  } catch (error: unknown) {
    const e = error as { message?: string; code?: string };
    console.error("[consultation/complete] error:", e.message, "code:", e.code);
    return NextResponse.json({ error: e.message ?? "Internal server error", code: e.code }, { status: 500 });
  }
}
