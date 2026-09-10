import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { captureTrash } from "@/lib/trash";
import { syncClientWeight } from "@/lib/weight-log";

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

  await syncClientWeight(params.id);

  return NextResponse.json(log);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.weightLog.findUnique({ where: { id: params.logId } });
  if (!existing || existing.clientId !== params.id) {
    return NextResponse.json({ error: "Không tìm thấy bản ghi" }, { status: 404 });
  }

  await captureTrash("WEIGHT_LOG", params.logId, session.user);
  await prisma.weightLog.delete({ where: { id: params.logId } });

  await syncClientWeight(params.id);

  return NextResponse.json({ success: true });
}
