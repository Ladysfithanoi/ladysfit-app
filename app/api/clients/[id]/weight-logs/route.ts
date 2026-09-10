import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordWeightLog } from "@/lib/weight-log";

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

  const log = await recordWeightLog({
    clientId: params.id,
    date: new Date(date),
    weight: parseFloat(weight),
    note: note || null,
  });

  return NextResponse.json(log, { status: 201 });
}
