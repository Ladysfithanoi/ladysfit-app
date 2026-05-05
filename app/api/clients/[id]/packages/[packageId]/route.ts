import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: { id: string; packageId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { startDate, sessionsUsed, status, notes, contractCode } = body;

  const existing = await prisma.packageEnrollment.findUnique({
    where: { id: params.packageId },
  });
  if (!existing || existing.clientId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (startDate !== undefined) {
    if (startDate) {
      const start = new Date(startDate);
      const end = new Date(startDate);
      end.setDate(end.getDate() + existing.durationDays);
      data.startDate = start;
      data.endDate = end;
    } else {
      data.startDate = null;
      data.endDate = null;
    }
  }

  if (sessionsUsed !== undefined) data.sessionsUsed = Number(sessionsUsed);
  if (status !== undefined) data.status = status;
  if (notes !== undefined) data.notes = notes || null;
  if (contractCode !== undefined) data.contractCode = contractCode || null;

  const updated = await prisma.packageEnrollment.update({
    where: { id: params.packageId },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; packageId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.packageEnrollment.findUnique({
    where: { id: params.packageId },
  });
  if (!existing || existing.clientId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.packageEnrollment.delete({ where: { id: params.packageId } });
  return NextResponse.json({ ok: true });
}
