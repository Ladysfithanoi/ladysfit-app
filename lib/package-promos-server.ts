import { prisma } from "@/lib/prisma";
import type { ActivePromo } from "@/lib/package-promos";

/**
 * Các đợt trợ giá ĐANG CHẠY ở một cơ sở tại một thời điểm.
 *
 * Đây là định nghĩa duy nhất của "đang chạy": bật, đúng cơ sở, và thời điểm nằm
 * trong khoảng [startsAt, endsAt]. Bảng giá lúc tư vấn và giá ghi vào hợp đồng
 * đều gọi hàm này, nên không có chuyện màn hình báo một đằng hợp đồng ghi một nẻo.
 */
export async function getActivePromos(
  branchId: string | null | undefined,
  at: Date = new Date()
): Promise<ActivePromo[]> {
  if (!branchId) return [];

  const rows = await prisma.packagePromo.findMany({
    where: {
      branchId,
      isActive: true,
      startsAt: { lte: at },
      endsAt: { gte: at },
    },
    include: { items: { orderBy: { packageName: "asc" } } },
    orderBy: { startsAt: "asc" },
  });

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    shortLabel: p.shortLabel,
    endsAt: p.endsAt.toISOString(),
    items: p.items.map((i) => ({ packageName: i.packageName, price: i.price })),
  }));
}
