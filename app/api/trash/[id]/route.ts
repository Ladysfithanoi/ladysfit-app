import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/trash/[id] — xóa vĩnh viễn một dòng trong thùng rác.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const item = await prisma.trashItem.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  await prisma.trashItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
