import { prisma } from "@/lib/prisma";
import { excludeTestBranch, viewerSeesTestData } from "@/lib/test-data";

/**
 * Cơ sở một người được xem trong thống kê Tổng quan — cùng luật với trang
 * Tổng quan Admin/FM (app/dashboard/page.tsx): Admin xem toàn hệ thống, FM chỉ
 * các cơ sở mình quản lý; bỏ nhánh Fitpartner và cơ sở test.
 *
 * `branchId` (tuỳ chọn) thu hẹp về một cơ sở — chỉ khi cơ sở đó nằm trong phạm
 * vi được xem. null = vai trò không được xem thống kê này.
 */
export async function statsBranchIds(
  user: { role: string; email?: string | null; managedBranchIds?: string[] },
  branchId?: string | null,
): Promise<string[] | null> {
  if (user.role !== "ADMIN" && user.role !== "FM") return null;
  const branches = await prisma.branch.findMany({
    where: {
      name: { not: { contains: "Fitpartner" } },
      ...excludeTestBranch(viewerSeesTestData(user)),
      ...(user.role === "FM" ? { id: { in: user.managedBranchIds ?? [] } } : {}),
    },
    select: { id: true },
  });
  const ids = branches.map((b) => b.id);
  if (branchId) return ids.includes(branchId) ? [branchId] : [];
  return ids;
}

/** month/year từ query (?month=10&year=2026), mặc định tháng hiện tại. */
export function monthYearParams(url: string): { month: number; year: number } {
  const sp = new URL(url).searchParams;
  const now = new Date();
  const month = parseInt(sp.get("month") || String(now.getMonth() + 1), 10);
  const year = parseInt(sp.get("year") || String(now.getFullYear()), 10);
  return {
    month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: year >= 2000 && year <= 2100 ? year : now.getFullYear(),
  };
}
