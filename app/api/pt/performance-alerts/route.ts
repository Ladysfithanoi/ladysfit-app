import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const alerts = await prisma.performanceAlert.findMany({
    where: { ptId: session.user.id, isRead: false },
    include: { client: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(
    alerts.map((a) => ({
      id: a.id,
      alertType: a.alertType,
      weekStart: a.weekStart.toISOString(),
      expectedRate: a.expectedRate,
      actualRate: a.actualRate,
      weeksAnalyzed: a.weeksAnalyzed ?? null,
      note: a.note ?? null,
      createdAt: a.createdAt.toISOString(),
      client: a.client,
    }))
  );
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await req.json() as { ids: string[] };

  await prisma.performanceAlert.updateMany({
    where: { id: { in: ids }, ptId: session.user.id },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
