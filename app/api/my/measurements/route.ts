import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request) {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.bodyMeasurementLog.findMany({
    where: { clientId: session.user.id },
    include: { measuredBy: { select: { id: true, name: true } } },
    orderBy: { measuredDate: "desc" },
  });

  return NextResponse.json(logs);
}

export async function POST(req: Request) {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { measuredDate, waist, belly, armSize, armFromElbow, thighSize, thighFromKnee, calfSize, calfFromKnee, notes } = body;

  if (!measuredDate) return NextResponse.json({ error: "Thiếu ngày đo" }, { status: 400 });

  const log = await prisma.bodyMeasurementLog.create({
    data: {
      clientId:      session.user.id,
      measuredById:  null,
      measuredDate:  new Date(measuredDate),
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
  });

  // Notify assigned PT
  const client = await prisma.client.findUnique({
    where: { id: session.user.id },
    select: { fullName: true, assignedPTId: true },
  });
  if (client) {
    await prisma.measurementNotification.create({
      data: {
        userId:   client.assignedPTId,
        clientId: session.user.id,
        message:  `📏 ${client.fullName} vừa cập nhật số đo của họ`,
      },
    });
  }

  return NextResponse.json(log, { status: 201 });
}
