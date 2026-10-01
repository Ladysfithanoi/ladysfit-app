import { NextResponse } from "next/server";
import { checkWeeklyProgress } from "@/lib/performance-check";

// 8h sáng thứ Hai (giờ VN): xét tuần vừa kết thúc, khách nào giảm cân dưới chỉ
// tiêu thì báo PT, FM của cơ sở và Admin. Trước đây Admin phải tự bấm "Chạy
// kiểm tra" ở trang Báo cáo. Xem lib/performance-check.ts.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await checkWeeklyProgress());
}
