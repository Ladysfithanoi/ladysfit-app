import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countPackageSession } from "@/lib/workout-session";

// POST /api/clients/[id]/workout-logs/check-in
// Starts a session: the client signs to confirm they showed up, then we create
// an IN_PROGRESS workout log (with the check-in signature) and a scaffold of
// empty set logs. The check-in signature is the proof the client trained, so
// this is where the package's sessionsUsed is deducted (buổi tập của khách).
// The PT's teaching session (salary) is only credited later at check-out.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { programId, weekId, sessionId, checkInSignatureUrl } = (await req.json()) as {
      programId?: string;
      weekId?: string;
      sessionId?: string;
      checkInSignatureUrl?: string | null;
    };
    if (!programId || !weekId || !sessionId) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }
    const checkInSig = (checkInSignatureUrl ?? "").trim();
    if (!checkInSig) {
      return NextResponse.json({ error: "Cần chữ ký xác nhận của khách hàng để check-in" }, { status: 400 });
    }

    // Resume: if an in-progress session already exists for this client+session,
    // return it instead of creating a duplicate (handles page reloads). The
    // package was already deducted when that log was created — don't deduct again.
    const existing = await prisma.workoutLog.findFirst({
      where: { clientId: params.id, sessionId, status: "IN_PROGRESS" },
      include: {
        setLogs: { orderBy: { id: "asc" } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({ ...serialize(existing), packageUpdate: null });
    }

    // Build the set-log scaffold from the session's current movements.
    const workoutSession = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: { movements: { orderBy: { order: "asc" } } },
    });
    if (!workoutSession) {
      return NextResponse.json({ error: "Không tìm thấy buổi tập" }, { status: 404 });
    }

    const now = new Date();
    const log = await prisma.workoutLog.create({
      data: {
        clientId: params.id,
        programId,
        weekId,
        sessionId,
        sessionDate: now,
        status: "IN_PROGRESS",
        checkInAt: now,
        checkInSignatureUrl: checkInSig,
        packageCounted: true,
        createdById: session.user.id,
        setLogs: {
          // Set 1 lấy luôn thông số nhân sự đã chuẩn bị sẵn trong giáo án. Đổ vào
          // ngay từ đây nên phần điền sẵn theo tuần trước ở nhật ký (chỉ điền khi
          // Set 1 còn trống) sẽ không đè lên — hai bên là MỘT Set 1, không phải
          // hai ô chạy song song.
          create: workoutSession.movements.map((m) => ({
            movementId: m.id,
            movementName: m.movementName,
            exerciseName: m.selectedExercise,
            set1Load: m.plannedLoad,
            set1Reps: m.plannedReps,
          })),
        },
      },
      include: {
        setLogs: { orderBy: { id: "asc" } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Deduct one session from the client's package now (client signed in).
    // countPackageSession charges the oldest gói that is còn hạn + còn buổi.
    const packageUpdate = await countPackageSession(params.id);

    // Remember which lộ trình was charged so a later delete/void refunds the
    // exact same package (the client may have several active packages).
    if (packageUpdate) {
      await prisma.workoutLog.update({
        where: { id: log.id },
        data: { packageEnrollmentId: packageUpdate.id },
      });
    }

    return NextResponse.json({ ...serialize(log), packageUpdate });
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[workout-logs check-in]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}

type LogWithRelations = Awaited<ReturnType<typeof prisma.workoutLog.findFirstOrThrow>> & {
  setLogs: unknown[];
  createdBy: { id: string; name: string | null };
};

function serialize(log: LogWithRelations) {
  return {
    ...log,
    sessionDate: log.sessionDate.toISOString(),
    createdAt: log.createdAt.toISOString(),
    checkInAt: log.checkInAt?.toISOString() ?? null,
    checkOutAt: log.checkOutAt?.toISOString() ?? null,
    firstInteractionAt: log.firstInteractionAt?.toISOString() ?? null,
  };
}
