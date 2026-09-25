import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { parseMeasurementBody } from "@/lib/body-measurements";

export async function GET() {
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
  const { measuredDate, notes } = body;

  if (!measuredDate) return NextResponse.json({ error: "Thiếu ngày đo" }, { status: 400 });

  const log = await prisma.bodyMeasurementLog.create({
    data: {
      clientId:      session.user.id,
      measuredById:  null,
      measuredDate:  new Date(measuredDate),
      ...parseMeasurementBody(body),
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
