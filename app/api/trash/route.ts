import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TRASH_TYPE_OPTIONS, getTrashRetentionDays, purgeExpiredTrash } from "@/lib/trash";
import type { Prisma } from "@prisma/client";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

/** Dựng điều kiện lọc dùng chung cho cả GET (xem) và DELETE (dọn). */
function buildWhere(url: URL): Prisma.TrashItemWhereInput {
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const q = url.searchParams.get("q")?.trim();

  const where: Prisma.TrashItemWhereInput = {};
  if (type && type !== "ALL") where.entityType = type;

  if (from || to) {
    const range: Prisma.DateTimeFilter = {};
    if (from) range.gte = new Date(`${from}T00:00:00`);
    if (to) range.lte = new Date(`${to}T23:59:59.999`);
    where.deletedAt = range;
  }

  if (q) {
    where.OR = [
      { label: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
      { deletedByName: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

// GET /api/trash — danh sách dữ liệu đã xóa, có lọc theo loại / ngày xóa.
export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Dọn bản ghi quá hạn ngay khi Admin mở thùng rác — không phụ thuộc cron.
  await purgeExpiredTrash().catch((err) => console.error("[trash] purge", err));

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = 50;
  const where = buildWhere(url);

  const [items, total, retentionDays, typeCounts] = await Promise.all([
    prisma.trashItem.findMany({
      where,
      orderBy: { deletedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        label: true,
        summary: true,
        branchName: true,
        deletedByName: true,
        deletedByRole: true,
        deletedAt: true,
      },
    }),
    prisma.trashItem.count({ where }),
    getTrashRetentionDays(),
    prisma.trashItem.groupBy({ by: ["entityType"], _count: { _all: true } }),
  ]);

  return NextResponse.json({
    items: items.map((i) => ({ ...i, deletedAt: i.deletedAt.toISOString() })),
    total,
    page,
    pageSize,
    retentionDays,
    types: TRASH_TYPE_OPTIONS.map((t) => ({
      ...t,
      count: typeCounts.find((c) => c.entityType === t.value)?._count._all ?? 0,
    })),
  });
}

// DELETE /api/trash — xóa vĩnh viễn. Không kèm bộ lọc = dọn sạch toàn bộ.
export async function DELETE(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const where = buildWhere(url);
  const { count } = await prisma.trashItem.deleteMany({ where });

  return NextResponse.json({ ok: true, deleted: count });
}
