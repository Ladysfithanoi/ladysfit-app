import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.bodyMeasurementLog.findMany({
    where: { clientId: params.id },
    include: { measuredBy: { select: { id: true, name: true } } },
    orderBy: { measuredDate: "desc" },
  });

  return NextResponse.json(logs);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { measuredDate, waist, belly, armSize, armFromElbow, thighSize, thighFromKnee, calfSize, calfFromKnee, notes } = body;

  if (!measuredDate) return NextResponse.json({ error: "Thiếu ngày đo" }, { status: 400 });

  const log = await prisma.bodyMeasurementLog.create({
    data: {
      clientId: params.id,
      measuredById: session.user.id,
      measuredDate: new Date(measuredDate),
      waist:        waist        != null ? parseFloat(waist)        : null,
      belly:        belly        != null ? parseFloat(belly)        : null,
      armSize:      armSize      != null ? parseFloat(armSize)      : null,
      armFromElbow: armFromElbow != null ? parseFloat(armFromElbow) : null,
      thighSize:    thighSize    != null ? parseFloat(thighSize)    : null,
      thighFromKnee: thighFromKnee != null ? parseFloat(thighFromKnee) : null,
      calfSize:     calfSize     != null ? parseFloat(calfSize)     : null,
      calfFromKnee: calfFromKnee != null ? parseFloat(calfFromKnee) : null,
      notes:        notes || null,
    },
    include: { measuredBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(log, { status: 201 });
}
