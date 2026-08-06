import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPackageOngoing } from "@/lib/client-status";
import { closeFinishedPackages } from "@/lib/package-status";

// Daily sweep, hai bước:
//  1. Đóng mọi lộ trình đã hết buổi (hết số buổi khách check-in) hoặc hết hạn —
//     ACTIVE → COMPLETED / EXPIRED.
//  2. Khách đang "Đang tập" mà không còn lộ trình nào chạy và chưa mua gói mới
//     thì chuyển sang "Nghỉ tập".
// Đây là nơi bắt trường hợp "hết hạn" theo thời gian mà không request nào chạm tới.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const closed = await closeFinishedPackages();

  const now = new Date();
  const activeClients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      packageEnrollments: { select: { status: true, endDate: true } },
    },
  });

  const toPause = activeClients
    .filter(
      (c) =>
        c.packageEnrollments.length > 0 &&
        !c.packageEnrollments.some((p) => isPackageOngoing(p, now))
    )
    .map((c) => c.id);

  if (toPause.length > 0) {
    await prisma.client.updateMany({
      where: { id: { in: toPause } },
      data: { status: "PAUSED" },
    });
  }

  return NextResponse.json({
    packagesCompleted: closed.completed,
    packagesExpired:   closed.expired,
    paused:            toPause.length,
  });
}
