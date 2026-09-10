import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { recordWeightLog } from "@/lib/weight-log";

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

  const log = await recordWeightLog({
    clientId,
    date: new Date(date),
    weight: parseFloat(weight),
    note: note || null,
  });

  return NextResponse.json(log, { status: 201 });
}
