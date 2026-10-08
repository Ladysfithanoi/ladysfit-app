import { NextResponse }     from "next/server";
import { getServerSession }  from "next-auth";
import { authOptions }       from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaughtSessions, getSessionAdjustments, keepBranchSessions } from "@/lib/pt-session-count";
import { payBranchScope } from "@/lib/salary-live";
import { emptyBuckets, tallyShows, type ShowBuckets } from "@/lib/session-pay";
import { canReadSalary } from "@/lib/salary-access";
import { vnMonthStart } from "@/lib/format-date";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReadSalary(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId") ?? "";
  const month    = parseInt(searchParams.get("month") ?? "1");
  const year     = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));
  const userIds  = (searchParams.get("userIds") ?? "").split(",").filter(Boolean);

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
  if (!managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gte = vnMonthStart(year, month);
  const lt  = vnMonthStart(year, month + 1);

  // "Số buổi PT" — chỉ buổi đã check-out có chữ ký kèm nhật ký buổi tập, cộng
  // phần Admin/FM chỉnh tay "Số buổi PT" ở hồ sơ khách cho tháng này.
  const [rows, adjustments, users] = await Promise.all([
    getTaughtSessions(userIds, gte, lt),
    getSessionAdjustments(userIds, month, year),
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, role: true } }),
  ]);
  const roleOf = new Map(users.map((u) => [u.id, u.role as string]));

  const result: Record<string, ShowBuckets> = {};
  for (const userId of userIds) {
    // Admin làm nhiều cơ sở: chỉ buổi của khách cơ sở này — xem payBranchScope.
    const scope = payBranchScope(roleOf.get(userId) ?? "", branchId);
    result[userId] = tallyShows(
      await keepBranchSessions(rows.filter((r) => r.ptId === userId), scope),
      await keepBranchSessions(adjustments.filter((a) => a.ptId === userId), scope),
    );
  }
  // Người không có buổi nào vẫn phải có đủ rổ rỗng để màn tạo bảng lương đọc được.
  for (const userId of userIds) result[userId] ??= emptyBuckets();

  return NextResponse.json(result);
}
