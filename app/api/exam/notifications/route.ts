import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.upgradeNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.upgradeNotification.count({ where: { readAt: null } }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PUT() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.upgradeNotification.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
