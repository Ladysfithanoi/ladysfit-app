import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reversePackageSession, sessionIdsWithLogs } from "@/lib/workout-session";

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
    include: { sessions: { orderBy: { order: "asc" }, include: { movements: true } } },
  });
  if (!week) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Buổi nào đã có nhật ký (chữ ký check-in/check-out, số liệu set của khách) —
  // lưu giáo án KHÔNG BAO GIỜ được xoá những buổi này.
  const withLogs = await sessionIdsWithLogs(week.sessions.map((s) => s.id));

  // Update sessions in-place to preserve session IDs. Deleting and recreating
  // sessions would cascade-delete all WorkoutLogs for those sessions, wiping
  // every recorded set/note/chữ ký from previous training dates.
  //
  // Ghép buổi cũ ↔ buổi mới theo VỊ TRÍ (đã sắp theo `order`), không theo GIÁ TRỊ
  // `order`. Client luôn gửi order = 0..n-1, trong khi `order` dưới DB có thể bị
  // hổng (đã xoá 1 buổi) hoặc trùng (đổi số buổi/tuần) — khớp theo giá trị khiến
  // buổi ở order "lạ" không match với gì cả và bị xoá kèm toàn bộ nhật ký. Đồng
  // thời đánh số lại `order` về 0..n-1 để dữ liệu cũ bị lệch tự lành.
  const incoming = [...body.sessions].sort((a, b) => a.order - b.order);

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < incoming.length; i++) {
      const s = incoming[i];
      const existing = week.sessions[i];

      if (existing) {
        // Keep the same session ID → WorkoutLogs stay intact
        await tx.workoutSession.update({
          where: { id: existing.id },
          data: { sessionName: s.sessionName, order: i },
        });
        // Replace only the movement list (movements carry no log history of their own)
        await tx.workoutMovement.deleteMany({ where: { sessionId: existing.id } });
        await tx.workoutMovement.createMany({
          data: s.movements.map((m) => ({ ...m, sessionId: existing.id })),
        });
      } else {
        // Brand-new session — safe to create from scratch
        await tx.workoutSession.create({
          data: {
            programId: params.programId,
            weekId: params.weekId,
            sessionName: s.sessionName,
            order: i,
            movements: { create: s.movements },
          },
        });
      }
    }

    // Buổi dư so với payload (vd giáo án gửi lên ít buổi hơn tuần đang có): chỉ
    // xoá khi CHƯA có nhật ký nào. Buổi đã tập được giữ lại và đánh số tiếp phía
    // sau — xoá chúng là mất vĩnh viễn nhật ký + chữ ký của khách.
    let nextOrder = incoming.length;
    for (const extra of week.sessions.slice(incoming.length)) {
      if (withLogs.has(extra.id)) {
        await tx.workoutSession.update({ where: { id: extra.id }, data: { order: nextOrder++ } });
      } else {
        await tx.workoutSession.delete({ where: { id: extra.id } });
      }
    }

    if (body.notes !== undefined) {
      await tx.workoutWeek.update({
        where: { id: params.weekId },
        data: { notes: body.notes },
      });
    }
  });

  const updated = await prisma.workoutWeek.findUnique({
    where: { id: params.weekId },
    include: { sessions: sessionInclude },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; programId: string; weekId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the week belongs to this program and client
  const week = await prisma.workoutWeek.findUnique({
    where: { id: params.weekId, programId: params.programId },
    select: { id: true, weekNumber: true, programId: true },
  });
  if (!week) return NextResponse.json({ error: "Không tìm thấy tuần tập" }, { status: 404 });

  // Safety check: must be the highest-numbered week
  const maxWeek = await prisma.workoutWeek.findFirst({
    where: { programId: params.programId },
    orderBy: { weekNumber: "desc" },
    select: { id: true },
  });
  if (maxWeek?.id !== params.weekId) {
    return NextResponse.json({ error: "Chỉ được xóa tuần cao nhất" }, { status: 400 });
  }

  // Xoá tuần sẽ cascade xuống buổi tập → nhật ký → chữ ký check-in/check-out.
  // Buổi đã hoàn thành là bằng chứng khách đã tập và là căn cứ tính lương PT, nên
  // không cho xoá cả tuần khi trong tuần còn buổi COMPLETED. Muốn bỏ thì xoá từng
  // buổi (luồng đó có cảnh báo rõ và hoàn buổi lại cho lộ trình của khách).
  const completedCount = await prisma.workoutLog.count({
    where: { weekId: params.weekId, status: "COMPLETED" },
  });
  if (completedCount > 0) {
    return NextResponse.json(
      {
        error: `Tuần này đã có ${completedCount} buổi tập hoàn thành (có chữ ký của khách) nên không thể xóa cả tuần. Nếu cần, hãy xóa từng buổi một.`,
      },
      { status: 400 }
    );
  }

  // Các nhật ký còn lại (đang tập dở / đã hủy) đã trừ buổi của khách lúc check-in
  // → hoàn lại đúng lộ trình đã trừ trước khi xoá, giống luồng xóa từng buổi.
  const countedLogs = await prisma.workoutLog.findMany({
    where: { weekId: params.weekId, packageCounted: true },
    select: { packageEnrollmentId: true },
  });
  for (const counted of countedLogs) {
    await reversePackageSession(params.id, counted.packageEnrollmentId);
  }

  // WorkoutLog, WorkoutSession, WorkoutMovement đều onDelete: Cascade → xóa week là xong
  await prisma.workoutWeek.delete({ where: { id: params.weekId } });

  // Update program's currentWeek if it was pointing to the deleted week
  const remaining = await prisma.workoutWeek.findMany({
    where: { programId: params.programId },
    orderBy: { weekNumber: "desc" },
    select: { weekNumber: true },
  });
  const newCurrentWeek = remaining[0]?.weekNumber ?? 1;
  await prisma.workoutProgram.update({
    where: { id: params.programId },
    data: { currentWeek: newCurrentWeek },
  });

  return NextResponse.json({ deletedWeekId: params.weekId, newCurrentWeek });
}
