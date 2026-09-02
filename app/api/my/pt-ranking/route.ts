import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { computeRanking } from "@/lib/ranking";
import { currentPeriod, periodLabel, type RankPeriod } from "@/lib/ranking-config";

// Bảng xếp hạng nhân sự cho khách hàng xem ở trang Tổng quan.
// Chỉ trả về thứ hạng, điểm tổng và số khách transform — doanh số và điểm thi
// là số liệu nội bộ nên không gửi ra ngoài cổng khách hàng.
export async function GET(req: Request) {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = new URL(req.url).searchParams.get("period") === "quarter" ? "quarter" : "year";
  const now = currentPeriod();
  const period: RankPeriod = { ...now, type };

  const [client, rows] = await Promise.all([
    prisma.client.findUnique({
      where: { id: session.user.id },
      select: { assignedPTId: true },
    }),
    computeRanking(period),
  ]);

  const myPtId = client?.assignedPTId ?? null;

  return NextResponse.json({
    periodLabel: periodLabel(period),
    myPtId,
    rows: rows.map((r) => ({
      ptId: r.ptId,
      rank: r.rank,
      name: r.name,
      branchName: r.branchName,
      levelName: r.levelName,
      levelColor: r.levelColor,
      transformedCount: r.transformedCount,
      points: r.points,
    })),
  });
}
