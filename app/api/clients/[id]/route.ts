import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { logPTAssignment } from "@/lib/transform-credit";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        assignedPT: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true } },
        weightLogs: { orderBy: { date: "asc" } },
      },
    });

    if (!client) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    return NextResponse.json(client);
  } catch (err) {
    console.error("[GET /api/clients/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (role !== "ADMIN" && role !== "FM") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    select: { id: true, branchId: true, fullName: true },
  });
  if (!client) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  if (role === "FM") {
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    if (!managedBranchIds.includes(client.branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Release the FK reference before deleting the client so no constraint blocks us.
      // Consultation.convertedClientId has no onDelete clause — must be nulled manually.
      await tx.consultation.updateMany({
        where: { convertedClientId: params.id },
        data: { convertedClientId: null },
      });
      await tx.client.delete({ where: { id: params.id } });
    });
  } catch (err) {
    console.error("[DELETE /api/clients/[id]]", err);
    return NextResponse.json({ error: "Không thể xóa khách hàng. Vui lòng thử lại." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!["ADMIN", "FM", "PT", "COO", "CEO_FITPARTNER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  // PT is forbidden from changing initialWeight
  if (role === "PT" && body.initialWeight !== undefined && body.initialWeight !== null) {
    return NextResponse.json({ error: "PT không được phép chỉnh sửa cân nặng ban đầu" }, { status: 403 });
  }

  const client = await prisma.client.update({
    where: { id: params.id },
    data: {
      fullName: body.fullName,
      phone: body.phone,
      email: body.email ?? undefined,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
      initialWeight: body.initialWeight ? parseFloat(body.initialWeight) : undefined,
      currentWeight: body.currentWeight ? parseFloat(body.currentWeight) : undefined,
      targetWeight: body.targetWeight ? parseFloat(body.targetWeight) : undefined,
      height: body.height ? parseFloat(body.height) : undefined,
      initialWaist: body.initialWaist != null ? parseFloat(body.initialWaist) || null : undefined,
      initialHip: body.initialHip != null ? parseFloat(body.initialHip) || null : undefined,
      healthConditions: body.healthConditions ?? undefined,
      injuries: body.injuries ?? undefined,
      targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
      goalNote: body.goalNote ?? undefined,
      assignedPTId: body.assignedPTId ?? undefined,
      branchId: body.branchId ?? undefined,
      dietPhase: body.dietPhase ?? undefined,
      status: body.status ?? undefined,
      avatarUrl: "avatarUrl" in body ? (body.avatarUrl ?? null) : undefined,
    },
  });

  // Đổi người phụ trách ở form sửa hồ sơ cũng phải vào nhật ký, nếu không
  // transform của khách sẽ được quy nhầm cho người mới nhận (lib/transform-credit).
  if (body.assignedPTId) {
    await logPTAssignment(params.id, body.assignedPTId, "EDITED");
  }

  return NextResponse.json(client);
}
