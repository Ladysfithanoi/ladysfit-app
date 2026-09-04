import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

/** Quyền hợp lệ — enum cố định trong code, Admin chỉ CHỌN chứ không đặt ra mới. */
const ROLES: Role[] = ["ADMIN", "FM", "CEO_FITPARTNER", "COO", "PT", "STAFF"];

/**
 * Chức vụ nhân sự — danh sách Admin tự quản.
 *
 * Đây là NHÃN NGHỀ NGHIỆP, không phải quyền. Thêm "Lao công" ở đây không cấp
 * thêm quyền nào cho ai; quyền vẫn nằm ở User.role (enum cố định trong code).
 *
 * GET mở cho mọi người đăng nhập vì nhiều màn cần hiện nhãn chức vụ; thêm/sửa/
 * xoá chỉ Admin.
 */

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const positions = await prisma.jobPosition.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { _count: { select: { users: { where: { deletedAt: null } } } } },
  });
  return NextResponse.json(positions);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Tên chức vụ không được trống" }, { status: 400 });

  const existing = await prisma.jobPosition.findUnique({ where: { name } });
  if (existing) return NextResponse.json({ error: "Chức vụ này đã có rồi" }, { status: 409 });

  const max = await prisma.jobPosition.aggregate({ _max: { order: true } });

  const created = await prisma.jobPosition.create({
    data: {
      name,
      color: typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : "#6b7280",
      // Quyền không hợp lệ thì rơi về STAFF — thấp nhất, không phải quyền cao nhất.
      role: ROLES.includes(body.role as Role) ? (body.role as Role) : "STAFF",
      order: (max._max.order ?? -1) + 1,
    },
    include: { _count: { select: { users: { where: { deletedAt: null } } } } },
  });

  return NextResponse.json(created, { status: 201 });
}
