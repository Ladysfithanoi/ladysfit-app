import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logPTAssignment } from "@/lib/transform-credit";

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
  const canRequest = ["ADMIN", "FM", "PT"].includes(role);
  if (!canRequest) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { substituteId, type, durationDays, notes, targetBranchId } = body as {
    substituteId: string;
    type: "SHORT_TERM" | "LONG_TERM";
    durationDays?: number;
    notes?: string;
    /** Cơ sở Admin chọn trên giao diện — dùng làm cơ sở đích khi chuyển khách. */
    targetBranchId?: string;
  };

  if (!substituteId || !type) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }
  if (type === "SHORT_TERM" && (!durationDays || durationDays < 1)) {
    return NextResponse.json({ error: "Vui lòng nhập số ngày hỗ trợ" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    select: { id: true, fullName: true, assignedPTId: true, branchId: true },
  });
  if (!client) return NextResponse.json({ error: "Không tìm thấy khách hàng" }, { status: 404 });

  if (substituteId === client.assignedPTId) {
    return NextResponse.json({ error: "PT đang phụ trách không thể tự nhờ chính mình" }, { status: 400 });
  }

  const substitute = await prisma.user.findFirst({
    where: { id: substituteId, deletedAt: null },
    select: {
      id: true, name: true, email: true, branchId: true,
      // FM không có branchId — cơ sở của họ là các cơ sở được phân công quản lý.
      managedBranches: { select: { branchId: true } },
    },
  });
  if (!substitute) {
    return NextResponse.json({ error: "Không tìm thấy nhân sự được chọn" }, { status: 404 });
  }

  const substituteBranchIds = [
    ...(substitute.branchId ? [substitute.branchId] : []),
    ...substitute.managedBranches.map((m) => m.branchId),
  ];

  // Nhân sự nhận khách ở cơ sở khác → đây là việc phân khách sang cơ sở khác,
  // chỉ Admin được làm. Chuyển giao DÀI HẠN thì khách đổi luôn cơ sở theo nhân
  // sự mới; hỗ trợ ngắn hạn chỉ là dạy hộ tạm nên khách vẫn thuộc cơ sở cũ.
  const crossBranch = client.branchId
    ? !substituteBranchIds.includes(client.branchId)
    : substituteBranchIds.length > 0;
  let destinationBranchId: string | null = null;
  if (crossBranch) {
    if (role !== "ADMIN") {
      return NextResponse.json(
        { error: "Chỉ Admin mới được phân khách sang cơ sở khác." },
        { status: 403 }
      );
    }
    // Cơ sở đích: ưu tiên cơ sở Admin chọn trên giao diện (FM có thể quản lý
    // nhiều cơ sở), sau đó tới cơ sở làm việc của nhân sự.
    destinationBranchId =
      (targetBranchId && substituteBranchIds.includes(targetBranchId) ? targetBranchId : null) ??
      substitute.branchId ??
      (substituteBranchIds.length === 1 ? substituteBranchIds[0] : null);
    if (!destinationBranchId) {
      return NextResponse.json(
        { error: "Nhân sự được chọn chưa thuộc cơ sở nào." },
        { status: 400 }
      );
    }
  }
  const movesBranch = crossBranch && type === "LONG_TERM" && !!destinationBranchId;

  // Cancel any existing active substitute requests for this client
  await prisma.substituteRequest.updateMany({
    where: { clientId: params.id, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });

  if (type === "LONG_TERM") {
    // Transfer permanently — update assignedPTId (kèm cơ sở nếu chuyển khác cơ sở)
    await prisma.$transaction([
      prisma.client.update({
        where: { id: params.id },
        data: {
          assignedPTId: substituteId,
          ...(movesBranch ? { branchId: destinationBranchId as string } : {}),
        },
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
    // Mở chặng phụ trách mới: transform khách đạt được TRƯỚC hôm nay vẫn thuộc
    // về người cũ, người nhận phải kèm đủ 6 tuần mới được ghi công
    // (lib/transform-credit).
    await logPTAssignment(params.id, substituteId, "TRANSFERRED");
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
  const notifMessage = movesBranch
    ? `🔄 KH ${client.fullName} được chuyển sang cơ sở của bạn — bạn phụ trách từ nay`
    : `🔄 Bạn được nhờ dạy hộ KH ${client.fullName} — ${typeLabel}`;
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO checklist_notifications (id, "userId", type, message, "isRead", date, "relatedId", "createdAt")
    VALUES (gen_random_uuid()::text, ${substituteId}, 'SUBSTITUTE_REQUEST'::"ChecklistNotifType", ${notifMessage}, false, ${now}, ${params.id}, ${now})
  `;

  return NextResponse.json({ success: true, movedBranch: movesBranch });
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
