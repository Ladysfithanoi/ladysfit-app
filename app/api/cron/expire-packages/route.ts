import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPackageOngoing, reactivateClientOnNewPackage } from "@/lib/client-status";
import { closeFinishedPackages, reopenExtendedPackages } from "@/lib/package-status";

// Daily sweep, ba bước:
//  1. Mở lại lộ trình đã hết hạn nhưng nay lại còn hạn — gói được gia hạn / bảo
//     lưu thêm ngày mà trạng thái còn kẹt ở EXPIRED. Phải chạy TRƯỚC bước đóng.
//  2. Đóng mọi lộ trình đã hết buổi (hết số buổi khách check-in) hoặc hết hạn —
//     ACTIVE → COMPLETED / EXPIRED.
//  3. Khách đang "Đang tập" mà không còn lộ trình nào chạy và chưa mua gói mới
//     thì chuyển sang "Nghỉ tập".
// Đây là nơi bắt trường hợp "hết hạn" theo thời gian mà không request nào chạm tới.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const revivedClientIds = await reopenExtendedPackages();
  for (const id of revivedClientIds) await reactivateClientOnNewPackage(id);

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
    packagesReopened:  revivedClientIds.length,
    packagesCompleted: closed.completed,
    packagesExpired:   closed.expired,
    paused:            toPause.length,
  });
}
