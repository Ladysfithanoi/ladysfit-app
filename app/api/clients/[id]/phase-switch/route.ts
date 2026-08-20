import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluatePhaseSwitch, switchClientPhase } from "@/lib/phase-progression";

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

/**
 * Người này có được đụng vào hồ sơ khách này không — cùng luật với trang hồ sơ
 * khách: Admin mọi khách, FM khách thuộc cơ sở mình quản lý, PT khách mình phụ
 * trách hoặc đang được nhờ dạy hộ.
 */
async function canManageClient(
  user: { id: string; role?: string | null; managedBranchIds?: string[] | null },
  clientId: string
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { branchId: true, assignedPTId: true },
  });
  if (!client) return false;
  if (user.role === "FM") {
    return (user.managedBranchIds ?? []).includes(client.branchId);
  }
  if (client.assignedPTId === user.id) return true;
  const sub = await prisma.substituteRequest.findFirst({
    where: {
      clientId,
      substituteId: user.id,
      status: "ACTIVE",
      OR: [{ type: "LONG_TERM" }, { endDate: { gt: new Date() } }],
    },
    select: { id: true },
  });
  return sub != null;
}

/**
 * Danh sách giai đoạn người đang đăng nhập được chuyển khách sang, kèm lý do cho
 * giai đoạn bị chặn. Giao diện gọi khi mở hộp thoại "Chuyển giai đoạn".
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = {
    id: session.user.id,
    role: session.user.role,
    managedBranchIds: session.user.managedBranchIds ?? [],
  };
  if (!(await canManageClient(actor, params.id))) {
    return NextResponse.json({ error: "Bạn không phụ trách khách hàng này." }, { status: 403 });
  }

  const info = await evaluatePhaseSwitch(params.id, actor);
  return NextResponse.json(info);
}

/**
 * Chuyển khách sang giai đoạn `order` — body: { order: number }.
 *
 * Đây là thao tác THỦ CÔNG duy nhất đổi giai đoạn; hệ thống không còn tự chuyển.
 * Luật kiểm tra nằm trong lib/phase-progression (tuần tự, lùi lại chỉ Admin, đủ
 * số tuần, và quyền giai đoạn theo cấp độ của PT).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = {
    id: session.user.id,
    role: session.user.role,
    managedBranchIds: session.user.managedBranchIds ?? [],
  };
  if (!(await canManageClient(actor, params.id))) {
    return NextResponse.json({ error: "Bạn không phụ trách khách hàng này." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { order?: number };
  const result = await switchClientPhase(params.id, Number(body.order), actor);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Trả về nguyên danh sách chương trình (kèm tuần/buổi) để giao diện áp lại
  // ngay — lần chuyển đầu có thể vừa TẠO MỚI chương trình cho giai đoạn đích.
  const programs = await prisma.workoutProgram.findMany({
    where: { clientId: params.id },
    include: fullProgramInclude,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, programs });
}
