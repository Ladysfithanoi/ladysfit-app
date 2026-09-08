import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { voidOverCapSessions } from "@/lib/workout-session";

// GET /api/workout-logs/my-running
// Buổi tập đang chạy dở do CHÍNH người đang đăng nhập mở, nếu có.
//
// Một người chỉ dạy được một khách một lúc, nên hồ sơ khách dùng cái này để khoá
// nút check-in kèm lý do ngay khi mở trang — thay vì để PT ký chữ ký của khách
// xong mới ăn 409 từ POST /clients/[id]/workout-logs/check-in. Chặn thật vẫn nằm
// ở route đó; đây chỉ là để giao diện nói trước.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Buổi quá 2 tiếng chưa check-out coi như bỏ dở — huỷ trước khi trả lời, để một
  // buổi bị quên từ hôm qua không khoá người dạy ở mọi khách. Cùng thao tác mà
  // route check-in làm, nên hai bên luôn thấy một danh sách giống nhau.
  await voidOverCapSessions();

  const log = await prisma.workoutLog.findFirst({
    where: {
      createdById: session.user.id,
      status: { in: ["IN_PROGRESS", "AWAITING_CONFIRMATION"] },
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

  if (!log) return NextResponse.json(null);

  return NextResponse.json({
    id: log.id,
    clientId: log.clientId,
    clientName: log.client?.fullName ?? null,
    sessionName: log.session?.sessionName ?? null,
    checkInAt: log.checkInAt?.toISOString() ?? null,
  });
}
