import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recountClientContracts } from "@/lib/recount-contracts";
import { refreshClientChurnStatus } from "@/lib/client-status";

export async function PUT(
  req: Request,
  { params }: { params: { id: string; packageId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { startDate, sessionsUsed, status, notes, contractCode, reservedDays, extensionDays } = body;

  const existing = await prisma.packageEnrollment.findUnique({
    where: { id: params.packageId },
  });
  if (!existing || existing.clientId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (sessionsUsed !== undefined) data.sessionsUsed = Number(sessionsUsed);
  if (status !== undefined) data.status = status;
  if (notes !== undefined) data.notes = notes || null;
  if (contractCode !== undefined) data.contractCode = contractCode || null;

  // Resolve the effective values for endDate recalculation
  const effectiveReserved = reservedDays !== undefined ? Number(reservedDays) : existing.reservedDays;
  const effectiveExtension = extensionDays !== undefined ? Number(extensionDays) : existing.extensionDays;

  if (reservedDays !== undefined) data.reservedDays = effectiveReserved;
  if (extensionDays !== undefined) data.extensionDays = effectiveExtension;

  // Recalculate endDate whenever startDate, reservedDays, or extensionDays changes
  if (startDate !== undefined || reservedDays !== undefined || extensionDays !== undefined) {
    const effectiveStart = startDate !== undefined
      ? (startDate ? new Date(startDate) : null)
      : existing.startDate;

    if (startDate !== undefined) data.startDate = effectiveStart;

    if (effectiveStart) {
      const end = new Date(effectiveStart);
      end.setDate(end.getDate() + existing.durationDays + effectiveReserved + effectiveExtension);
      data.endDate = end;
    } else {
      data.endDate = null;
    }
  }

  const updated = await prisma.packageEnrollment.update({
    where: { id: params.packageId },
    data,
  });

  // Sửa gói thủ công (đánh dấu hết hạn/hoàn thành, đổi ngày...) cũng có thể khiến
  // khách hết lộ trình → tự chuyển sang "Nghỉ tập" nếu không còn lộ trình nào chạy.
  await refreshClientChurnStatus(params.id);

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
  await recountClientContracts(params.id);
  return NextResponse.json({ ok: true });
}
