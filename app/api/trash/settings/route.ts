import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTrashRetentionDays, purgeExpiredTrash } from "@/lib/trash";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

// GET /api/trash/settings — số ngày giữ dữ liệu trong thùng rác.
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ retentionDays: await getTrashRetentionDays() });
}

// PUT /api/trash/settings — Admin đổi số ngày tự động xóa (0 = giữ mãi).
export async function PUT(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { retentionDays } = (await req.json()) as { retentionDays?: number };
  if (typeof retentionDays !== "number" || !Number.isFinite(retentionDays)) {
    return NextResponse.json({ error: "Số ngày không hợp lệ" }, { status: 400 });
  }

  const days = Math.round(retentionDays);
  if (days < 0 || days > 3650) {
    return NextResponse.json({ error: "Số ngày phải từ 0 đến 3650" }, { status: 400 });
  }

  await prisma.systemConfig.upsert({
    where: { id: "main" },
    update: { trashRetentionDays: days },
    create: { id: "main", trashRetentionDays: days },
  });

  // Hạ số ngày xuống có thể làm một loạt bản ghi quá hạn ngay lập tức — dọn luôn
  // để con số hiển thị khớp với cài đặt vừa lưu.
  const purged = await purgeExpiredTrash();

  return NextResponse.json({ ok: true, retentionDays: days, purged });
}
