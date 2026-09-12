import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reversePackageSession } from "@/lib/workout-session";
import { captureTrash } from "@/lib/trash";

const sessionInclude = {
  orderBy: { order: "asc" as const },
  include: { movements: { orderBy: { order: "asc" as const } } },
};

// DELETE /api/clients/[id]/programs/[programId]/weeks/[weekId]/sessions/[sessionId]
//
// Xoá một Ô BUỔI (Buổi 1/2/…) khỏi một tuần của giáo án — tức là sửa CẤU TRÚC
// giáo án, không phải xoá lịch sử tập.
//
// BUỔI ĐÃ CÓ NGƯỜI KÝ CHECK-IN THÌ KHÔNG XOÁ ĐƯỢC Ở ĐÂY. WorkoutLog.session là
// onDelete: Cascade, nên xoá ô buổi là cuốn theo toàn bộ nhật ký của nó: chữ ký
// check-in, chữ ký check-out, ẢNH check-out và mọi số liệu set. Cặp chữ ký + ảnh
// sinh ra để chứng minh buổi tập có thật (xem lib/checkin-sheet) — một nút sửa
// cấu trúc giáo án không được là đường xoá sạch bằng chứng ấy chỉ bằng một cú bấm.
//
// Muốn bỏ thật thì đi đúng đường đã có: xoá NHẬT KÝ của buổi đó ngay trong nhật ký
// tập ("Xóa buổi tập này (trừ khỏi số buổi đã tính)") — đường đó hoàn đúng buổi về
// đúng lộ trình và để lại vết. Nhật ký hết rồi thì ô buổi xoá bình thường.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; programId: string; weekId: string; sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workoutSession = await prisma.workoutSession.findFirst({
      where: { id: params.sessionId, weekId: params.weekId, programId: params.programId },
      select: { id: true },
    });
    if (!workoutSession) {
      return NextResponse.json({ error: "Không tìm thấy buổi tập" }, { status: 404 });
    }

    // Đã có ai ký check-in thì dừng ở đây — kể cả buổi đang tập dở hay buổi đã bị
    // huỷ quá 2 tiếng: chúng đều mang chữ ký check-in của khách.
    const logs = await prisma.workoutLog.findMany({
      where: { sessionId: params.sessionId },
      select: { status: true },
    });
    if (logs.length > 0) {
      const done = logs.filter((l) => l.status === "COMPLETED").length;
      const what =
        done === logs.length ? `${done} buổi đã tập`
        : done > 0           ? `${done} buổi đã tập và ${logs.length - done} nhật ký khác`
        :                      `${logs.length} nhật ký`;
      return NextResponse.json(
        {
          error:
            `Không thể xoá ô buổi này: khách đã ký check-in (${what}). ` +
            "Xoá nhật ký của buổi đó trước — mở buổi tập, bấm thùng rác ở dòng nhật ký " +
            "(“Xóa buổi tập này”) — rồi mới xoá được ô buổi.",
          reason: "HAS_LOGS",
        },
        { status: 409 }
      );
    }

    // Keep at least one session per week so the week is never left empty.
    const sessionCount = await prisma.workoutSession.count({ where: { weekId: params.weekId } });
    if (sessionCount <= 1) {
      return NextResponse.json(
        { error: "Không thể xóa buổi tập cuối cùng của tuần. Mỗi tuần cần ít nhất 1 buổi." },
        { status: 400 }
      );
    }

    let packageUpdate: {
      id: string; sessionsUsed: number; sessions: number; packageName: string; status: string;
    } | null = null;

    // Lưới an toàn cho khe hở giữa lúc kiểm tra ở trên và lúc xoá: khách vừa kịp
    // ký check-in đúng lúc này thì buổi vẫn phải được hoàn về đúng lộ trình đã trừ,
    // thay vì bị cascade cuốn đi mà lộ trình giữ nguyên số buổi đã dùng. Bình
    // thường vòng lặp này không chạy lần nào.
    const countedLogs = await prisma.workoutLog.findMany({
      where: { clientId: params.id, sessionId: params.sessionId, packageCounted: true },
      select: { packageEnrollmentId: true },
    });
    for (const counted of countedLogs) {
      const reversed = await reversePackageSession(params.id, counted.packageEnrollmentId);
      if (reversed) packageUpdate = reversed;
    }

    await captureTrash("WORKOUT_SESSION", params.sessionId, session.user);
    await prisma.workoutSession.delete({ where: { id: params.sessionId } });

    const week = await prisma.workoutWeek.findUnique({
      where: { id: params.weekId },
      include: { sessions: sessionInclude },
    });

    return NextResponse.json({ week, deletedSessionId: params.sessionId, packageUpdate });
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[workout session delete]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}

// PUT .../sessions/[sessionId] — lưu Set 1 nhân sự chuẩn bị trước cho buổi tập.
//
// Body: { movements: [{ id, plannedLoad, plannedReps }] }
//
// Đây là CHIỀU giáo án → nhật ký của cặp đồng bộ Set 1 (chiều ngược lại nằm ở
// `syncPlannedSetsFromLog`). Nếu buổi đang được tập dở thì cập nhật luôn Set 1
// trong nhật ký đang mở, để hai nơi không hiện hai con số khác nhau.
export async function PUT(
  req: Request,
  { params }: { params: { id: string; programId: string; weekId: string; sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workoutSession = await prisma.workoutSession.findFirst({
      where: { id: params.sessionId, weekId: params.weekId, programId: params.programId },
      select: { id: true },
    });
    if (!workoutSession) {
      return NextResponse.json({ error: "Không tìm thấy buổi tập" }, { status: 404 });
    }

    const body = (await req.json()) as {
      movements?: { id: string; plannedLoad?: string | null; plannedReps?: string | null }[];
    };
    const rows = body.movements ?? [];

    // Chỉ nhận chuyển động THUỘC buổi này — id gửi lên là dữ liệu từ trình duyệt.
    const owned = await prisma.workoutMovement.findMany({
      where: { sessionId: params.sessionId, id: { in: rows.map((m) => m.id) } },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((m) => m.id));

    const clean = (v: string | null | undefined) => {
      if (v == null) return null;
      const s = String(v).trim();
      return s === "" ? null : s;
    };

    const updates = rows
      .filter((m) => ownedIds.has(m.id))
      .map((m) => ({
        id: m.id,
        plannedLoad: clean(m.plannedLoad),
        plannedReps: clean(m.plannedReps),
      }));

    await Promise.all(
      updates.map((m) =>
        prisma.workoutMovement.update({
          where: { id: m.id },
          data: { plannedLoad: m.plannedLoad, plannedReps: m.plannedReps },
        })
      )
    );

    // Buổi đang tập dở → đẩy luôn sang Set 1 của nhật ký đang mở.
    const liveLog = await prisma.workoutLog.findFirst({
      where: { clientId: params.id, sessionId: params.sessionId, status: "IN_PROGRESS" },
      select: { id: true },
    });
    if (liveLog && updates.length > 0) {
      await Promise.all(
        updates.map((m) =>
          prisma.workoutSetLog.updateMany({
            where: { workoutLogId: liveLog.id, movementId: m.id },
            data: { set1Load: m.plannedLoad, set1Reps: m.plannedReps },
          })
        )
      );
    }

    const updated = await prisma.workoutSession.findUnique({
      where: { id: params.sessionId },
      include: { movements: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({ session: updated, liveLogId: liveLog?.id ?? null });
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[workout session planned-sets]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
