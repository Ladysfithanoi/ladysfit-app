import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadPhaseMovements, slotsForSession } from "@/lib/movement-templates";
import { allowedPhasesForActor } from "@/lib/phase-progression";
import { workoutTypeForPhase } from "@/lib/workout-structure";
import { pickChargeablePackage } from "@/lib/checkin-eligibility";
import { TRIAL_PACKAGE } from "@/lib/packages";
import { isL0Phase } from "@/lib/l0-program";

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

  // Giáo án được tạo phải nằm trong quyền theo cấp độ PT — cùng luật với ô chọn
  // giai đoạn ở giao diện (/api/admin/phases đã lọc) và với việc chuyển giai
  // đoạn. Luật nằm ở server để mọi đường gọi vào đây đều sạch.
  if (body.phaseId) {
    const { phases: allowedPhases, restricted } = await allowedPhasesForActor(session.user);
    if (restricted && !allowedPhases.some((p) => p.id === body.phaseId)) {
      return NextResponse.json(
        { error: "Cấp độ PT của bạn chưa được cấp quyền giai đoạn này." },
        { status: 403 }
      );
    }
  }

  if (!Number.isInteger(body.sessionsPerWeek) || body.sessionsPerWeek < 1 || body.sessionsPerWeek > 7) {
    return NextResponse.json({ error: "Số buổi/tuần phải từ 1 đến 7" }, { status: 400 });
  }
  const startWeek = body.currentWeek && body.currentWeek >= 1 ? body.currentWeek : 1;

  // ── Liên kết chéo — cùng kết quả dù tạo từ Tổng quan hay tab CT Tập ──
  // Giáo án (WorkoutPhase) quyết định tên + loại hình tập, như luồng tư vấn và
  // chuyển giai đoạn; ô loại hình gõ tay chỉ là ghi đè khi người tạo cố ý.
  const phaseRow = body.phaseId
    ? await prisma.workoutPhase.findUnique({ where: { id: body.phaseId }, select: { name: true, templateKey: true } })
    : null;
  const phaseName = phaseRow?.name ?? body.phase;
  const workoutType = body.workoutType?.trim() || workoutTypeForPhase(phaseName, phaseRow?.templateKey) || null;

  // Lộ trình: gói được chọn (phải là của khách này); không chọn thì gói đang
  // trừ buổi — buổi L0 nhận gói L0, các giai đoạn khác nhận gói thật.
  const clientPackages = await prisma.packageEnrollment.findMany({
    where: { clientId: params.id },
    select: { id: true, packageName: true, status: true, sessions: true, sessionsUsed: true, startDate: true, endDate: true, createdAt: true },
  });
  let packageEnrollmentId: string | null = null;
  if (body.packageEnrollmentId) {
    if (!clientPackages.some((p) => p.id === body.packageEnrollmentId)) {
      return NextResponse.json({ error: "Lộ trình không thuộc khách hàng này" }, { status: 400 });
    }
    packageEnrollmentId = body.packageEnrollmentId;
  } else {
    const l0 = isL0Phase(phaseName);
    const pool = clientPackages.filter((p) => (p.packageName === TRIAL_PACKAGE) === l0);
    packageEnrollmentId = (pickChargeablePackage(pool) ?? pickChargeablePackage(clientPackages))?.id ?? null;
  }

  // Phiếu tư vấn đã chuyển thành khách này (mới nhất) — để từ CT nhìn ngược về
  // buổi tư vấn gốc, giống chương trình tạo ở bước tư vấn.
  const consultation = await prisma.consultation.findFirst({
    where: { convertedClientId: params.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  // KHÔNG tự lưu trữ chương trình đang chạy ở đây: đưa CT vào kho lưu trữ chỉ
  // xảy ra khi người dùng bấm "Chuyển giai đoạn" (POST .../phase-switch), hoặc
  // khi họ tự đổi trạng thái CT. Tạo thêm một CT không phải là chuyển giai đoạn.

  const program = await prisma.workoutProgram.create({
    data: {
      clientId: params.id,
      createdById: session.user.id,
      phase: phaseName,
      phaseId: body.phaseId || null,
      workoutType,
      sessionsPerWeek: body.sessionsPerWeek,
      currentWeek: startWeek,
      packageEnrollmentId,
      consultationId: consultation?.id ?? null,
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
      // Chuyển động lấy từ Kho bài tập — giai đoạn Admin mới tạo chỉ có chuyển
      // động ở đó, mẫu tĩnh không biết tới nên buổi sẽ dựng ra rỗng.
      const movements = await loadPhaseMovements(phaseData);
      sessions = Array.from({ length: body.sessionsPerWeek }, (_, i) => {
        const sessionType =
          phaseData.sessionTypes.length > 0
            ? phaseData.sessionTypes[i % phaseData.sessionTypes.length]
            : "Tạ 1";
        const slots = slotsForSession(
          movements,
          sessionType,
          phaseData.templateKey,
          phaseData.defaultReps
        );
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
