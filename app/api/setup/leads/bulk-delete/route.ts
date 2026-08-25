import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { captureTrashMany } from "@/lib/trash";

// Xóa nhiều lead cùng lúc. Kiểm tra quyền theo từng lead giống route xóa đơn lẻ:
//  - PT: chỉ xóa lead của chính mình
//  - FM: chỉ xóa lead thuộc cơ sở mình quản lý
//  - ADMIN/COO: xóa mọi lead (CEO_FitPartner chỉ được xem)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "PT";
  const isFM = role === "FM";
  const isAdmin = role === "ADMIN";
  const isCOO = role === "COO";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (!isPT && !isFM && !isAdmin && !isCOO) {
    return NextResponse.json({ error: "Không có quyền xóa lead" }, { status: 403 });
  }

  const { ids } = (await req.json()) as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Thiếu danh sách lead" }, { status: 400 });
  }

  const leads = await prisma.salesLead.findMany({
    where: { id: { in: ids } },
    select: { id: true, assignedPTId: true, branchId: true },
  });

  const deletableIds = leads
    .filter((l) => {
      if (isAdmin || isCOO) return true;
      if (isFM) return managedBranchIds.includes(l.branchId);
      if (isPT) return l.assignedPTId === session.user.id;
      return false;
    })
    .map((l) => l.id);

  if (deletableIds.length > 0) {
    await captureTrashMany("SALES_LEAD", deletableIds, session.user);
    await prisma.transaction.deleteMany({ where: { referenceId: { in: deletableIds } } });
    await prisma.salesLead.deleteMany({ where: { id: { in: deletableIds } } });
  }

  return NextResponse.json({
    deleted: deletableIds.length,
    skipped: ids.length - deletableIds.length,
    deletedIds: deletableIds,
  });
}
