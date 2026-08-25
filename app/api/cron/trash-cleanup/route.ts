import { NextResponse } from "next/server";
import { getTrashRetentionDays, purgeExpiredTrash } from "@/lib/trash";

// Vercel Cron: chạy 00:00 UTC hàng ngày.
// Xóa vĩnh viễn dữ liệu trong thùng rác đã quá số ngày Admin cài đặt.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const retentionDays = await getTrashRetentionDays();
  const purged = await purgeExpiredTrash();

  return NextResponse.json({
    ok: true,
    retentionDays,
    purged,
    message:
      retentionDays <= 0
        ? "Thùng rác đang đặt giữ mãi — không dọn gì"
        : `Đã xóa vĩnh viễn ${purged} bản ghi quá ${retentionDays} ngày`,
  });
}
