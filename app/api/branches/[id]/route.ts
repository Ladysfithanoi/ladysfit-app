import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (role !== "ADMIN" && !isFM) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (isFM && !managedBranchIds.includes(params.id)) {
    return NextResponse.json({ error: "FM chỉ có thể chỉnh sửa cơ sở mình quản lý" }, { status: 403 });
  }

  const { name, address } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Tên cơ sở không được để trống" }, { status: 400 });

  const branch = await prisma.branch.update({
    where: { id: params.id },
    data: { name: name.trim(), address: address?.trim() || null },
  });

  return NextResponse.json(branch);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const branch = await prisma.branch.findUnique({
    where: { id: params.id },
    include: { _count: { select: { users: true, clients: true } } },
  });

  if (!branch) return NextResponse.json({ error: "Không tìm thấy cơ sở" }, { status: 404 });

  if (branch._count.users > 0 || branch._count.clients > 0) {
    return NextResponse.json(
      {
        error: `Cơ sở này đang có ${branch._count.users} nhân sự và ${branch._count.clients} khách hàng. Vui lòng chuyển họ sang cơ sở khác trước khi xóa.`,
      },
      { status: 400 }
    );
  }

  await prisma.branch.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
