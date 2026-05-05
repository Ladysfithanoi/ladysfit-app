import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.weightLog.findMany({
    where: { clientId: params.id },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(logs);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, weight, note } = await req.json();
  if (!date || !weight) {
    return NextResponse.json({ error: "Thiếu ngày hoặc cân nặng" }, { status: 400 });
  }

  const log = await prisma.weightLog.create({
    data: {
      clientId: params.id,
      date: new Date(date),
      weight: parseFloat(weight),
      note: note || null,
    },
  });

  // Update client's currentWeight to the latest log
  const [latest, client] = await Promise.all([
    prisma.weightLog.findFirst({ where: { clientId: params.id }, orderBy: { date: "desc" } }),
    prisma.client.findUnique({ where: { id: params.id }, select: { initialWeight: true, hasTransformed: true } }),
  ]);

  if (latest && client) {
    const lostKg = client.initialWeight - latest.weight;
    const nowTransformed = lostKg >= 7;
    await prisma.client.update({
      where: { id: params.id },
      data: {
        currentWeight: latest.weight,
        // hasTransformed is permanent — only set to true, never reset back to false
        ...(nowTransformed && !client.hasTransformed ? { hasTransformed: true } : {}),
      },
    });
  }

  return NextResponse.json(log, { status: 201 });
}
