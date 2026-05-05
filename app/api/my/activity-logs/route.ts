import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.activityLog.findMany({
    where: { clientId: session.user.id },
    orderBy: { date: "desc" },
    take: 30,
  });
  return NextResponse.json(logs);
}

export async function PUT(req: Request) {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, steps, minutesActive, minutesGym, note } = await req.json();
  if (!date) return NextResponse.json({ error: "Thiếu ngày" }, { status: 400 });

  const clientId = session.user.id;
  const dateObj = new Date(date);

  const log = await prisma.activityLog.upsert({
    where: { clientId_date: { clientId, date: dateObj } },
    create: { clientId, date: dateObj, steps, minutesActive, minutesGym, note },
    update: { steps, minutesActive, minutesGym, note },
  });

  return NextResponse.json(log);
}
