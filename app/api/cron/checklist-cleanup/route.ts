import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Vercel Cron: chạy 00:00 UTC ngày 1 hàng tháng.
// Xoá DailyChecklist cũ, GIỮ LẠI KEEP_MONTHS tháng gần nhất (tính cả tháng đang
// chạy) để FM còn xem lại được. Bản cũ xoá sạch mọi thứ trước ngày 1 của tháng
// hiện tại — chạy ngày 01/11 là mất toàn bộ checklist tới hết tháng 10.
// Cascade tự xoá ChecklistItem.
const KEEP_MONTHS = 3;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ngày 1 của tháng cách đây (KEEP_MONTHS - 1) tháng: chạy 01/11 với
  // KEEP_MONTHS = 3 → giữ từ 01/09, xoá từ tháng 8 trở về trước.
  const nowUTC = new Date();
  const cutoff = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth() - (KEEP_MONTHS - 1), 1));

  const deleted = await prisma.dailyChecklist.deleteMany({
    where: { reportDate: { lt: cutoff } },
  });

  return NextResponse.json({
    ok: true,
    deletedChecklists: deleted.count,
    cutoffDate: cutoff.toISOString().split("T")[0],
    message: `Đã xoá ${deleted.count} bản ghi check-list trước ${cutoff.toISOString().split("T")[0]} (giữ ${KEEP_MONTHS} tháng gần nhất)`,
  });
}
