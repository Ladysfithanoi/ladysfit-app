import { NextResponse }     from "next/server";
import { getServerSession }  from "next-auth";
import { authOptions }       from "@/lib/auth";
import { getTaughtSessions, getSessionAdjustments } from "@/lib/pt-session-count";
import { emptyBuckets, tallyShows, type ShowBuckets } from "@/lib/session-pay";
import { canReadSalary } from "@/lib/salary-access";

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

  const gte = new Date(year, month - 1, 1);
  const lt  = new Date(year, month, 1);

  // "Số buổi PT" — chỉ buổi đã check-out có chữ ký kèm nhật ký buổi tập, cộng
  // phần Admin/FM chỉnh tay "Số buổi PT" ở hồ sơ khách cho tháng này.
  const [rows, adjustments] = await Promise.all([
    getTaughtSessions(userIds, gte, lt),
    getSessionAdjustments(userIds, month, year),
  ]);

  const result: Record<string, ShowBuckets> = {};
  for (const userId of userIds) {
    result[userId] = tallyShows(
      rows.filter((r) => r.ptId === userId),
      adjustments.filter((a) => a.ptId === userId),
    );
  }
  // Người không có buổi nào vẫn phải có đủ rổ rỗng để màn tạo bảng lương đọc được.
  for (const userId of userIds) result[userId] ??= emptyBuckets();

  return NextResponse.json(result);
}
