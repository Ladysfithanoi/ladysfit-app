import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

// POST /api/consultation/[id]/share
// Cấp link cho khách xem màn "Tư vấn lộ trình" của buổi tư vấn này.
//
// Token sinh MỘT LẦN rồi giữ nguyên: tư vấn viên bấm Chia sẻ lần thứ hai vẫn ra
// đúng link cũ, nên link đã gửi qua Zalo hôm trước không chết. Ai cầm link cũng
// xem được (khách không có tài khoản để đăng nhập) — vì thế token phải đủ dài để
// không dò ra được, và trang khách chỉ hiện đúng màn lộ trình, không mở đường
// sang phần nào khác của buổi tư vấn.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const c = await prisma.consultation.findUnique({
      where: { id: params.id },
      select: { id: true, branchId: true, createdById: true, shareToken: true },
    });
    if (!c) return NextResponse.json({ error: "Không tìm thấy buổi tư vấn" }, { status: 404 });

    // Đúng quy tắc của trang tư vấn: ADMIN xem hết, FM xem cơ sở mình quản lý,
    // còn lại chỉ xem buổi của chính mình. Chia sẻ ra ngoài thì càng phải theo.
    const role = session.user.role;
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    const allowed =
      role === "ADMIN" ||
      (role === "FM" ? managedBranchIds.includes(c.branchId) : c.createdById === session.user.id);
    if (!allowed) return NextResponse.json({ error: "Không có quyền chia sẻ buổi tư vấn này" }, { status: 403 });

    // 32 ký tự base64url (~192 bit) — không dò được bằng cách thử.
    const token = c.shareToken ?? randomBytes(24).toString("base64url");
    if (!c.shareToken) {
      await prisma.consultation.update({ where: { id: c.id }, data: { shareToken: token } });
    }

    // Chỉ trả phần đường dẫn; trang gọi tự ghép với origin đang mở, nên link luôn
    // đúng tên miền mà tư vấn viên đang dùng, không phụ thuộc biến môi trường.
    return NextResponse.json({ token, path: `/tu-van/${token}` });
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[consultation share]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
