import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Vercel Cron: chạy 00:00 UTC ngày 1 hàng tháng
// Xóa DailyChecklist cũ hơn 35 ngày (cascade tự xóa ChecklistItem)
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 35);

  const deleted = await prisma.dailyChecklist.deleteMany({
    where: { reportDate: { lt: cutoff } },
  });

  return NextResponse.json({
    ok: true,
    deletedChecklists: deleted.count,
    cutoffDate: cutoff.toISOString().split("T")[0],
    message: `Đã xóa ${deleted.count} bản ghi check-list cũ hơn 35 ngày`,
  });
}
