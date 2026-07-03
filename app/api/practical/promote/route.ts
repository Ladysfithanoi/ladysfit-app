import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Thăng hạng THỦ CÔNG 1 bậc do FM/Admin quyết định (bỏ qua điều kiện tự động).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "FM") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { ptId } = (await req.json()) as { ptId: string };
  if (!ptId) return NextResponse.json({ error: "Thiếu ptId" }, { status: 400 });

  const pt = await prisma.user.findUnique({
    where: { id: ptId },
    select: { id: true, role: true, branchId: true, name: true, email: true, ptLevel: { select: { order: true } } },
  });
  if (!pt || pt.role !== "PT") return NextResponse.json({ error: "Không tìm thấy PT" }, { status: 404 });

  if (role === "FM") {
    const branchIds = session.user.managedBranchIds ?? [];
    if (!pt.branchId || !branchIds.includes(pt.branchId)) {
      return NextResponse.json({ error: "Không có quyền với PT này" }, { status: 403 });
    }
  }

  const nextLevel = await prisma.pTLevel.findFirst({
    where: { isActive: true, order: { gt: pt.ptLevel?.order ?? -1 } },
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });
  if (!nextLevel) {
    return NextResponse.json({ error: "PT đã ở cấp cao nhất" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: ptId }, data: { ptLevelId: nextLevel.id } });
  await prisma.upgradeNotification.create({
    data: { userId: ptId, userName: pt.name ?? pt.email ?? "PT", passed: true },
  });

  return NextResponse.json({ ok: true, newLevelName: nextLevel.name });
}
