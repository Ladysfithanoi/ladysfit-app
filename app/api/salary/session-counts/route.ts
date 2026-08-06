import { NextResponse }     from "next/server";
import { getServerSession }  from "next-auth";
import { authOptions }       from "@/lib/auth";
import { RESIDENT_PACKAGE }  from "@/lib/packages";
import { getTaughtSessions, getSessionAdjustments } from "@/lib/pt-session-count";

const L1_L2_LOYAL = new Set(["L1", "L2", "Loyalfit"]);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  // "Số buổi PT" — chỉ buổi đã check-out có chữ ký kèm nhật ký buổi tập.
  const rows = await getTaughtSessions(userIds, gte, lt);

  const result: Record<string, { showsL1L2Loyal: number; showsL3L4L5: number; showsResident: number }> = {};
  for (const userId of userIds) {
    result[userId] = { showsL1L2Loyal: 0, showsL3L4L5: 0, showsResident: 0 };
  }

  for (const row of rows) {
    const bucket = result[row.ptId];
    if (!bucket) continue;
    // KOL có cách tính hoa hồng riêng (60k/buổi), không nằm trong tiền buổi dạy.
    if (row.contractType === "KOL") continue;
    if (row.packageName === RESIDENT_PACKAGE) bucket.showsResident++;
    else if (L1_L2_LOYAL.has(row.packageName)) bucket.showsL1L2Loyal++;
    else bucket.showsL3L4L5++;
  }

  // Phần Admin/FM chỉnh tay "Số buổi PT" ở hồ sơ khách, ghi nhận vào tháng này.
  const adjustments = await getSessionAdjustments(userIds, month, year);
  for (const adj of adjustments) {
    const bucket = result[adj.ptId];
    if (!bucket) continue;
    if (adj.contractType === "KOL") continue;
    if (adj.packageName === RESIDENT_PACKAGE) bucket.showsResident += adj.delta;
    else if (L1_L2_LOYAL.has(adj.packageName)) bucket.showsL1L2Loyal += adj.delta;
    else bucket.showsL3L4L5 += adj.delta;
  }

  // Trừ tay quá đà không được để số buổi âm.
  for (const bucket of Object.values(result)) {
    bucket.showsL1L2Loyal = Math.max(0, bucket.showsL1L2Loyal);
    bucket.showsL3L4L5    = Math.max(0, bucket.showsL3L4L5);
    bucket.showsResident  = Math.max(0, bucket.showsResident);
  }

  return NextResponse.json(result);
}
