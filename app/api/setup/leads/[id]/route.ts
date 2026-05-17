import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncLeadRevenueToWeeklyActuals } from "@/lib/sync-revenue";
import { syncLeadToTransaction } from "@/lib/sync-finance";
import { syncLeadToClient } from "@/lib/sync-lead-to-client";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "PT";
  const isFM = role === "FM";
  const isAdmin = role === "ADMIN";
  const isCOO = role === "COO";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (!isPT && !isFM && !isAdmin && !isCOO) {
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

  const body = await req.json() as Record<string, unknown>;

  // FM/ADMIN/COO can reassign the staff; PT cannot change assignedPTId
  const canReassign = isFM || isAdmin || isCOO;
  const newAssignedPTId = (canReassign && body.assignedPTId) ? String(body.assignedPTId) : lead.assignedPTId;

  // Partial update: fall back to existing lead values for any field not present in the
  // request body. This prevents partial callers (e.g. the care-notes popup, which only
  // sends { notes }) from inadvertently nullifying revenue and other financial fields.
  const updated = await prisma.salesLead.update({
    where: { id: params.id },
    data: {
      assignedPTId: newAssignedPTId,
      customerName: "customerName" in body ? String(body.customerName ?? "") : lead.customerName,
      yearOfBirth: "yearOfBirth" in body ? (body.yearOfBirth ? parseInt(String(body.yearOfBirth)) : null) : lead.yearOfBirth,
      phone: "phone" in body ? (body.phone ? String(body.phone) : null) : lead.phone,
      source: "source" in body ? (body.source ? String(body.source) : null) : lead.source,
      notes: "notes" in body ? (body.notes ? String(body.notes) : null) : lead.notes,
      forecast: "forecast" in body ? (body.forecast ? String(body.forecast) : null) : lead.forecast,
      status: "status" in body && body.status ? body.status as "TAKECARE" | "FAIL" | "DE" | "PIF" | "PB" : lead.status,
      packageRegistered: "packageRegistered" in body ? (body.packageRegistered ? String(body.packageRegistered) : null) : lead.packageRegistered,
      actualRevenue: "actualRevenue" in body ? (body.actualRevenue != null ? parseFloat(String(body.actualRevenue)) : null) : lead.actualRevenue,
      remainingPayment: "remainingPayment" in body ? (body.remainingPayment != null ? parseFloat(String(body.remainingPayment)) : null) : lead.remainingPayment,
      fitpartnerRevenue: "fitpartnerRevenue" in body ? (body.fitpartnerRevenue != null ? parseFloat(String(body.fitpartnerRevenue)) : null) : lead.fitpartnerRevenue,
      signDate: "signDate" in body ? (body.signDate ? new Date(String(body.signDate)) : null) : lead.signDate,
      remark: "remark" in body ? (body.remark ? String(body.remark) : null) : lead.remark,
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

  // Auto-sync to client profile when status is PIF/DE/PB
  let syncedClientId = updated.syncedClientId ?? null;
  if (["PIF", "DE", "PB"].includes(updated.status) && !syncedClientId) {
    try {
      const clientId = await syncLeadToClient({
        id: updated.id,
        phone: updated.phone,
        packageRegistered: updated.packageRegistered,
        actualRevenue: updated.actualRevenue,
        signDate: updated.signDate,
        assignedPTId: updated.assignedPTId,
      });
      if (clientId) {
        await prisma.salesLead.update({
          where: { id: params.id },
          data: { syncedClientId: clientId },
        });
        syncedClientId = clientId;
      }
    } catch {
      // Non-critical — don't fail the request
    }
  }

  return NextResponse.json({ ...updated, syncedClientId });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "PT";
  const isFM = role === "FM";
  const isAdmin = role === "ADMIN";
  const isCOO = role === "COO";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (!isPT && !isFM && !isAdmin && !isCOO) {
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
