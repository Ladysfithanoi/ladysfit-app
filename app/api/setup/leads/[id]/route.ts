import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncLeadRevenueToWeeklyActuals } from "@/lib/sync-revenue";
import { syncLeadToTransaction } from "@/lib/sync-finance";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "FREE" || role === "RESTRICTED";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (!isPT && !isFM) {
    return NextResponse.json({ error: "Không có quyền sửa lead" }, { status: 403 });
  }

  const lead = await prisma.salesLead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  if (isPT && lead.assignedPTId !== session.user.id) {
    return NextResponse.json({ error: "Bạn chỉ có thể sửa lead của mình" }, { status: 403 });
  }
  if (isFM && !managedBranchIds.includes(lead.branchId)) {
    return NextResponse.json({ error: "Không có quyền quản lý chi nhánh này" }, { status: 403 });
  }

  const body = await req.json();

  // Only FM can reassign the PT; PT cannot change assignedPTId
  const newAssignedPTId = (isFM && body.assignedPTId) ? body.assignedPTId : lead.assignedPTId;

  const updated = await prisma.salesLead.update({
    where: { id: params.id },
    data: {
      assignedPTId: newAssignedPTId,
      customerName: body.customerName,
      yearOfBirth: body.yearOfBirth ? parseInt(body.yearOfBirth) : null,
      phone: body.phone || null,
      source: body.source || null,
      notes: body.notes || null,
      forecast: body.forecast || null,
      status: body.status,
      packageRegistered: body.packageRegistered || null,
      actualRevenue: body.actualRevenue != null ? parseFloat(body.actualRevenue) : null,
      remainingPayment: body.remainingPayment != null ? parseFloat(body.remainingPayment) : null,
      fitpartnerRevenue: body.fitpartnerRevenue != null ? parseFloat(body.fitpartnerRevenue) : null,
      signDate: body.signDate ? new Date(body.signDate) : null,
      remark: body.remark || null,
    },
    include: {
      assignedPT: { select: { id: true, name: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (["PIF", "DE", "PB"].includes(updated.status) && updated.signDate) {
    await syncLeadRevenueToWeeklyActuals(newAssignedPTId, lead.branchId, lead.month, lead.year);
    if (newAssignedPTId !== lead.assignedPTId) {
      await syncLeadRevenueToWeeklyActuals(lead.assignedPTId, lead.branchId, lead.month, lead.year);
    }
  }
  await syncLeadToTransaction(updated);

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "FREE" || role === "RESTRICTED";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (!isPT && !isFM) {
    return NextResponse.json({ error: "Không có quyền xóa lead" }, { status: 403 });
  }

  const lead = await prisma.salesLead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  if (isPT && lead.assignedPTId !== session.user.id) {
    return NextResponse.json({ error: "Bạn chỉ có thể xóa lead của mình" }, { status: 403 });
  }
  if (isFM && !managedBranchIds.includes(lead.branchId)) {
    return NextResponse.json({ error: "Không có quyền quản lý chi nhánh này" }, { status: 403 });
  }

  await prisma.transaction.deleteMany({ where: { referenceId: params.id } });
  await prisma.salesLead.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
