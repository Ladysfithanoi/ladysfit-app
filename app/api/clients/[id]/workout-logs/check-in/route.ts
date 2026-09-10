import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countPackageSession, voidOverCapSessions } from "@/lib/workout-session";
import {
  findCheckInBlock,
  runningSessionBlock,
  MAX_SESSION_MINUTES,
  RUNNING_LOG_STATUSES,
} from "@/lib/checkin-eligibility";
import { generatePackageProgressNotifications } from "@/lib/package-progress";
import { parseWeightInput, recordWeightLog } from "@/lib/weight-log";

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

    const { programId, weekId, sessionId, checkInSignatureUrl, weightKg } = (await req.json()) as {
      programId?: string;
      weekId?: string;
      sessionId?: string;
      checkInSignatureUrl?: string | null;
      /** Cân nặng PT cân cho khách ngay lúc check-in. KHÔNG bắt buộc. */
      weightKg?: number | string | null;
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

    // Dọn trước khi chặn: buổi quá 2 tiếng chưa check-out coi như bỏ dở, phải bị
    // huỷ ngay tại đây chứ không đợi cron. Nếu không, một buổi hôm qua bị quên sẽ
    // khoá người dạy ở MỌI khách (luật bên dưới) cho tới lần cron kế tiếp.
    await voidOverCapSessions();

    // Mốc 2 tiếng lặp lại ở các truy vấn dưới: lưới quét vừa chạy xong nên về lý
    // thuyết không còn bản ghi quá hạn nào, nhưng nếu nó lỡ sót một dòng (giờ
    // check-in rỗng chẳng hạn) thì chặn ở đây vẫn không khoá nhầm ai.
    const capThreshold = new Date(Date.now() - MAX_SESSION_MINUTES * 60_000);

    // MỘT KHÁCH CHỈ CÓ MỘT BUỔI ĐANG CHẠY. Buổi cũ chưa check-out mà mở buổi mới
    // thì lộ trình bị trừ hai buổi trong khi khách chỉ tập một, và buổi bỏ dở kia
    // cứ chạy tới mốc 2 tiếng rồi tự huỷ — PT mất buổi dạy mà không hiểu vì sao.
    // Đóng buổi đang chạy trước, hoặc xoá nó nếu lỡ check-in nhầm.
    //
    // Buổi CÙNG session đã được trả về ở nhánh "Resume" bên trên, nên tới đây chỉ
    // còn trường hợp buổi KHÁC đang dở.
    const running = await prisma.workoutLog.findFirst({
      where: {
        clientId: params.id,
        status: { in: [...RUNNING_LOG_STATUSES] },
        checkInAt: { gte: capThreshold },
      },
      select: {
        id: true,
        checkInAt: true,
        session: { select: { sessionName: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    if (running) {
      const block = runningSessionBlock({
        sessionName: running.session?.sessionName,
        checkInAt: running.checkInAt,
        ptName: running.createdBy?.name,
      });
      return NextResponse.json(
        { error: block.message, reason: block.reason, runningLogId: running.id },
        { status: 409 }
      );
    }

    // MỘT NGƯỜI DẠY CHỈ MỞ ĐƯỢC MỘT NHẬT KÝ. Luật trên mới chỉ khoá theo khách:
    // đang dạy khách A vẫn mở được nhật ký cho khách B, mà không ai dạy hai khách
    // cùng lúc được — hai buổi song song dưới một tài khoản nghĩa là có buổi được
    // ký khống, đúng thứ cặp chữ ký check-in/check-out sinh ra để chặn.
    //
    // Khách này đã được loại ở luật trên nên buổi tìm thấy ở đây chắc chắn nằm ở
    // KHÁCH KHÁC; vẫn ghi rõ điều kiện để đọc là hiểu ngay.
    const mine = await prisma.workoutLog.findFirst({
      where: {
        createdById: session.user.id,
        clientId: { not: params.id },
        status: { in: [...RUNNING_LOG_STATUSES] },
        checkInAt: { gte: capThreshold },
      },
      select: {
        id: true,
        clientId: true,
        checkInAt: true,
        client: { select: { fullName: true } },
        session: { select: { sessionName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    if (mine) {
      const block = runningSessionBlock({
        sessionName: mine.session?.sessionName,
        checkInAt: mine.checkInAt,
        clientName: mine.client?.fullName,
      });
      return NextResponse.json(
        {
          error: block.message,
          reason: block.reason,
          runningLogId: mine.id,
          runningClientId: mine.clientId,
        },
        { status: 409 }
      );
    }

    // HẾT BUỔI / HẾT HẠN → không cho bắt đầu buổi mới. Buổi tập chỉ được mở khi
    // khách còn một lộ trình trừ được buổi; nếu không, buổi vẫn chạy nhưng không
    // trừ vào lộ trình nào (countPackageSession trả null) — khách tập không mất
    // buổi mà PT vẫn được tính lương. Chặn ngay tại đây, trước khi tạo nhật ký.
    const packages = await prisma.packageEnrollment.findMany({
      where: { clientId: params.id },
      select: { status: true, sessions: true, sessionsUsed: true, endDate: true, createdAt: true },
    });
    const block = findCheckInBlock(packages);
    if (block) {
      return NextResponse.json({ error: block.message, reason: block.reason }, { status: 409 });
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

    // Cân nặng khách cân lúc check-in (nếu PT có điền) — vào thẳng nhật ký cân
    // nặng, cùng một đường với màn hình "Cập nhật cân nặng", nên biểu đồ, hồ sơ
    // và cột cân nặng của phiếu check-in đều thấy ngay.
    //
    // Ô này không bắt buộc: gõ sai (âm, quá ngưỡng người thật) thì bỏ qua chứ
    // KHÔNG chặn check-in — chữ ký khách đã ký rồi, không được vứt đi vì một ô
    // phụ. Giao diện đã chặn số vô lý trước khi gửi.
    const weight = parseWeightInput(weightKg);
    if (weight != null) {
      try {
        await recordWeightLog({
          clientId: params.id,
          date: now,
          weight,
          note: "Cân lúc check-in buổi tập",
        });
      } catch (e) {
        console.error("[workout-logs check-in] ghi cân nặng", (e as { message?: string }).message);
      }
    }

    // Vừa trừ buổi xong thì soát luôn mốc tiến độ (50/70/90% số buổi) để FM thấy
    // ngay trong ngày thay vì đợi cron sáng hôm sau. Chỉ quét đúng khách này nên
    // rất nhẹ. Chờ hẳn thay vì thả trôi vì hàm serverless có thể kết thúc trước
    // khi promise chạy xong; lỗi thì nuốt, cron hằng ngày vẫn hứng lại.
    if (packageUpdate) {
      try {
        await generatePackageProgressNotifications({ clientId: params.id });
      } catch {
        // thông báo cho FM là phụ — không được làm hỏng việc bắt đầu buổi tập
      }
    }

    return NextResponse.json({ ...serialize(log), packageUpdate, weightLogged: weight });
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
