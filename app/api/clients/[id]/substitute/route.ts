import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const active = await prisma.substituteRequest.findFirst({
    where: {
      clientId: params.id,
      status: "ACTIVE",
      OR: [
        { type: "LONG_TERM" },
        { endDate: { gt: new Date() } },
      ],
    },
    select: {
      id: true,
      type: true,
      startDate: true,
      endDate: true,
      durationDays: true,
      notes: true,
      substitute: { select: { id: true, name: true, email: true } },
      requestedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(active ?? null);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const canRequest =
    role === "ADMIN" || role === "FM" || role === "FREE" || role === "RESTRICTED" || role === "PT";
  if (!canRequest) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { substituteId, type, durationDays, notes } = body as {
    substituteId: string;
    type: "SHORT_TERM" | "LONG_TERM";
    durationDays?: number;
    notes?: string;
  };

  if (!substituteId || !type) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }
  if (type === "SHORT_TERM" && (!durationDays || durationDays < 1)) {
    return NextResponse.json({ error: "Vui lòng nhập số ngày hỗ trợ" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    select: { id: true, fullName: true, assignedPTId: true },
  });
  if (!client) return NextResponse.json({ error: "Không tìm thấy khách hàng" }, { status: 404 });

  if (substituteId === client.assignedPTId) {
    return NextResponse.json({ error: "PT đang phụ trách không thể tự nhờ chính mình" }, { status: 400 });
  }

  // Cancel any existing active substitute requests for this client
  await prisma.substituteRequest.updateMany({
    where: { clientId: params.id, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });

  if (type === "LONG_TERM") {
    // Transfer permanently — update assignedPTId
    await prisma.$transaction([
      prisma.client.update({
        where: { id: params.id },
        data: { assignedPTId: substituteId },
      }),
      prisma.substituteRequest.create({
        data: {
          clientId: params.id,
          requestedById: session.user.id,
          substituteId,
          type: "LONG_TERM",
          status: "ACTIVE",
          notes: notes || null,
        },
      }),
    ]);
  } else {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (durationDays ?? 1));

    await prisma.substituteRequest.create({
      data: {
        clientId: params.id,
        requestedById: session.user.id,
        substituteId,
        type: "SHORT_TERM",
        startDate: new Date(),
        endDate,
        durationDays: durationDays ?? 1,
        status: "ACTIVE",
        notes: notes || null,
      },
    });
  }

  // Notify substitute PT — raw SQL to support the SUBSTITUTE_REQUEST enum value
  const typeLabel = type === "SHORT_TERM" ? `${durationDays} ngày` : "Dài hạn";
  const notifMessage = `🔄 Bạn được nhờ dạy hộ KH ${client.fullName} — ${typeLabel}`;
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO checklist_notifications (id, "userId", type, message, "isRead", date, "relatedId", "createdAt")
    VALUES (gen_random_uuid()::text, ${substituteId}, 'SUBSTITUTE_REQUEST'::"ChecklistNotifType", ${notifMessage}, false, ${now}, ${params.id}, ${now})
  `;

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.substituteRequest.updateMany({
    where: { clientId: params.id, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ success: true });
}
