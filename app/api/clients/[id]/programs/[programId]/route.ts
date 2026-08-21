import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSlotsForSessionType } from "@/lib/workout-structure";
import { canBypassPhaseGate, phaseOrderOf } from "@/lib/phase-progression";
import { sessionIdsWithLogs } from "@/lib/workout-session";

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
    manualPhaseOverride?: boolean;
  };

  const existing = await prisma.workoutProgram.findUnique({
    where: { id: params.programId, clientId: params.id },
    select: { phase: true, phaseId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Đổi giai đoạn tập hiện tại NGAY TRÊN chương trình này (không lưu trữ CT nào,
  // không tạo CT mới) chỉ dành cho FM (cơ sở mình quản lý) và Admin. PT vẫn sửa
  // được các thông tin khác (số buổi/tuần, tuần hiện tại, loại hình tập, ghi chú).
  //
  // Khép giai đoạn — đưa CT đang chạy vào kho lưu trữ và mở CT cho giai đoạn kế —
  // là việc của POST /api/clients/[id]/phase-switch, ở đó mới có đủ luật tuần tự /
  // số tuần / quyền theo cấp độ PT.
  const phaseChanged =
    (body.phase !== undefined && body.phase !== existing.phase) ||
    (body.phaseId !== undefined && (body.phaseId ?? null) !== existing.phaseId);

  if (phaseChanged || body.manualPhaseOverride !== undefined) {
    const allowed = await canBypassPhaseGate(session.user, params.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Chỉ Quản lý (FM) phụ trách cơ sở hoặc Admin mới được đổi giai đoạn của khách." },
        { status: 403 }
      );
    }
  }

  // Chỉ Admin mới được chuyển khách VỀ giai đoạn trước đó. FM chỉ được giữ nguyên
  // hoặc mở lên giai đoạn cao hơn.
  if (phaseChanged && session.user.role !== "ADMIN") {
    const newOrder = phaseOrderOf(body.phase ?? existing.phase);
    const curOrder = phaseOrderOf(existing.phase);
    if (newOrder > 0 && curOrder > 0 && newOrder < curOrder) {
      return NextResponse.json(
        { error: "Chỉ Admin mới được chuyển khách về giai đoạn trước đó." },
        { status: 403 }
      );
    }
  }

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
      ...(body.manualPhaseOverride !== undefined ? { manualPhaseOverride: body.manualPhaseOverride } : {}),
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

      // Sau khi đồng bộ, mỗi tuần có đúng newCount buổi → buổi được đánh số liên
      // tục qua các tuần (tuần thứ wi bắt đầu từ wi * newCount + 1).
      for (let wi = 0; wi < prog.weeks.length; wi++) {
        const week = prog.weeks[wi];
        const currentCount = week.sessions.length;

        if (newCount > currentCount) {
          // Đánh số tiếp từ order lớn nhất đang có, KHÔNG lấy theo số lượng buổi:
          // `order` có thể bị hổng (đã xoá 1 buổi) nên dùng số lượng sẽ tạo ra buổi
          // trùng order, khiến lần lưu giáo án sau ghép nhầm buổi.
          let nextOrder = week.sessions.reduce((max, s) => Math.max(max, s.order), -1) + 1;
          for (let i = currentCount; i < newCount; i++) {
            const sessionType =
              sessionTypes.length > 0 ? sessionTypes[i % sessionTypes.length] : "Tạ 1";
            const slots = getSlotsForSessionType(sessionType, templateKey || undefined);
            await prisma.workoutSession.create({
              data: {
                programId: params.programId,
                weekId: week.id,
                sessionName: `Buổi ${wi * newCount + i + 1} — ${sessionType}`,
                order: nextOrder++,
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
          // Bớt số buổi/tuần chỉ được xoá các buổi CHƯA có nhật ký. Buổi đã tập giữ
          // nguyên — xoá sẽ cascade mất nhật ký, chữ ký check-in/check-out của khách
          // (và không hoàn buổi lại cho lộ trình). Muốn bỏ hẳn thì xoá từng buổi.
          const extra = week.sessions.slice(newCount);
          const withLogs = await sessionIdsWithLogs(extra.map((s) => s.id));
          const toDelete = extra.filter((s) => !withLogs.has(s.id)).map((s) => s.id);
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
