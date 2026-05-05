import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.weightLog.findMany({
    where: { clientId: session.user.id },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(logs);
}

export async function POST(req: Request) {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, weight, note } = await req.json();
  if (!date || !weight) {
    return NextResponse.json({ error: "Thiếu ngày hoặc cân nặng" }, { status: 400 });
  }

  const clientId = session.user.id;

  const log = await prisma.weightLog.create({
    data: {
      clientId,
      date: new Date(date),
      weight: parseFloat(weight),
      note: note || null,
    },
  });

  const [latest, client] = await Promise.all([
    prisma.weightLog.findFirst({ where: { clientId }, orderBy: { date: "desc" } }),
    prisma.client.findUnique({ where: { id: clientId }, select: { initialWeight: true, hasTransformed: true } }),
  ]);
  if (latest && client) {
    const lostKg = client.initialWeight - latest.weight;
    await prisma.client.update({
      where: { id: clientId },
      data: {
        currentWeight: latest.weight,
        ...(lostKg >= 7 && !client.hasTransformed ? { hasTransformed: true } : {}),
      },
    });
  }

  return NextResponse.json(log, { status: 201 });
}
