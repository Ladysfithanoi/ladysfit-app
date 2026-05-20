import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string; logId: string } };

export async function PUT(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, weight, note } = await req.json();
  if (!date || weight == null) {
    return NextResponse.json({ error: "Thiếu ngày hoặc cân nặng" }, { status: 400 });
  }

  const existing = await prisma.weightLog.findUnique({ where: { id: params.logId } });
  if (!existing || existing.clientId !== params.id) {
    return NextResponse.json({ error: "Không tìm thấy bản ghi" }, { status: 404 });
  }

  const log = await prisma.weightLog.update({
    where: { id: params.logId },
    data: {
      date: new Date(date),
      weight: parseFloat(String(weight)),
      note: note || null,
    },
  });

  // Recalculate currentWeight from latest log
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
        ...(nowTransformed && !client.hasTransformed ? { hasTransformed: true } : {}),
      },
    });
  }

  return NextResponse.json(log);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.weightLog.findUnique({ where: { id: params.logId } });
  if (!existing || existing.clientId !== params.id) {
    return NextResponse.json({ error: "Không tìm thấy bản ghi" }, { status: 404 });
  }

  await prisma.weightLog.delete({ where: { id: params.logId } });

  // Recalculate currentWeight from the new latest log
  const [latest, client] = await Promise.all([
    prisma.weightLog.findFirst({ where: { clientId: params.id }, orderBy: { date: "desc" } }),
    prisma.client.findUnique({ where: { id: params.id }, select: { initialWeight: true, hasTransformed: true } }),
  ]);

  if (latest && client) {
    await prisma.client.update({
      where: { id: params.id },
      data: { currentWeight: latest.weight },
    });
  }

  return NextResponse.json({ success: true });
}
