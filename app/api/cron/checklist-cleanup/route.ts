import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Vercel Cron: chạy 00:00 UTC ngày 1 hàng tháng
// Xóa DailyChecklist cũ hơn 35 ngày (cascade tự xóa ChecklistItem)
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Xóa toàn bộ dữ liệu của tháng trước (và các tháng cũ hơn)
  // Cron chạy ngày 1 hàng tháng → cutoff = ngày 1 của tháng hiện tại
  const nowUTC = new Date();
  const cutoff = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), 1));

  const deleted = await prisma.dailyChecklist.deleteMany({
    where: { reportDate: { lt: cutoff } },
  });

  return NextResponse.json({
    ok: true,
    deletedChecklists: deleted.count,
    cutoffDate: cutoff.toISOString().split("T")[0],
    message: `Đã xóa ${deleted.count} bản ghi check-list từ tháng trước trở về trước`,
  });
}
