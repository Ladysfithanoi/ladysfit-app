import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPackageOngoing } from "@/lib/client-status";

// Daily sweep: any client who is currently "Đang tập" but whose lộ trình have all
// finished (hết buổi / hết hạn) and who hasn't bought a new one is moved to "Nghỉ tập".
// This catches the time-based "hết hạn" case that no live request would otherwise hit.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  return NextResponse.json({ paused: toPause.length });
}
