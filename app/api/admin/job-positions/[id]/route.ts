import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : undefined;

  if (name === "") {
    return NextResponse.json({ error: "Tên chức vụ không được trống" }, { status: 400 });
  }
  if (name) {
    const clash = await prisma.jobPosition.findFirst({
      where: { name, id: { not: params.id } },
      select: { id: true },
    });
    if (clash) return NextResponse.json({ error: "Chức vụ này đã có rồi" }, { status: 409 });
  }

  const updated = await prisma.jobPosition.update({
    where: { id: params.id },
    data: {
      ...(name && { name }),
      ...(typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color) && { color: body.color }),
      ...(typeof body.isActive === "boolean" && { isActive: body.isActive }),
      ...(Number.isInteger(body.order) && { order: body.order }),
    },
    include: { _count: { select: { users: { where: { deletedAt: null } } } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const position = await prisma.jobPosition.findUnique({
    where: { id: params.id },
    include: { _count: { select: { users: { where: { deletedAt: null } } } } },
  });
  if (!position) return NextResponse.json({ error: "Không tìm thấy chức vụ" }, { status: 404 });

  // Còn người đang giữ chức vụ này thì không xoá — xoá đi là cả nhóm mất nhãn
  // mà không ai biết vì sao. Muốn ngừng dùng thì TẮT, nhãn cũ vẫn còn.
  if (position._count.users > 0) {
    return NextResponse.json(
      {
        error: `Chức vụ này đang có ${position._count.users} nhân sự. Chuyển họ sang chức vụ khác, hoặc tắt chức vụ này thay vì xoá.`,
      },
      { status: 400 }
    );
  }

  await prisma.jobPosition.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
