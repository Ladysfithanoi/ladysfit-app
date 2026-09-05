import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { captureTrash } from "@/lib/trash";
import { syncLeadRevenueToWeeklyActuals } from "@/lib/sync-revenue";
import { syncLeadToTransaction } from "@/lib/sync-finance";
import { syncLeadToClient } from "@/lib/sync-lead-to-client";
import { validateLeadFinance, type LeadFinanceStatus } from "@/lib/lead-pricing";

/** Các trường quyết định luật tiền — chỉ khi body đụng tới chúng mới kiểm tra lại. */
const FINANCE_FIELDS = ["status", "source", "packageRegistered", "actualRevenue", "remainingPayment"];

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
  const num = (v: unknown) => (v != null && v !== "" ? parseFloat(String(v)) : null);
  const nextStatus    = ("status" in body && body.status ? body.status : lead.status) as LeadFinanceStatus;
  const nextSource    = "source" in body ? (body.source ? String(body.source) : null) : lead.source;
  const nextPackage   = "packageRegistered" in body ? (body.packageRegistered ? String(body.packageRegistered) : null) : lead.packageRegistered;
  const nextRevenue   = "actualRevenue" in body ? num(body.actualRevenue) : lead.actualRevenue;
  const nextRemaining = "remainingPayment" in body ? num(body.remainingPayment) : lead.remainingPayment;

  // Chỉ soát luật tiền khi request thực sự đụng tới chúng — popup ghi chú chăm sóc
  // chỉ gửi { notes } nên không bị chặn bởi dữ liệu tiền cũ chưa chuẩn.
  const touchesFinance = FINANCE_FIELDS.some(f => f in body);
  if (touchesFinance) {
    const moneyError = validateLeadFinance({
      status: nextStatus,
      source: nextSource,
      packageRegistered: nextPackage,
      actualRevenue: nextRevenue,
      remainingPayment: nextRemaining,
    });
    if (moneyError) return NextResponse.json({ error: moneyError }, { status: 400 });
  }

  // Ngày ký chạy theo ô Doanh thu: có tiền thì giữ/ghi ngày ký, hết tiền thì xoá luôn.
  // Request không đụng tới tiền (popup ghi chú) thì giữ nguyên ngày ký sẵn có.
  //
  // CHỈ ADMIN đặt được ngày ký cụ thể. Ngày này quyết định hợp đồng nằm ở kỳ nào
  // của Bảng thu (xem transactionDateFor), nên nếu ai cũng gửi lên được thì chỉ
  // cần lùi vài ngày là một hợp đồng nhảy sang tháng khác. Ô nhập ở giao diện đã
  // khoá với người khác, nhưng khoá ở trình duyệt không phải là quyền.
  const rawSignDate = isAdmin && "signDate" in body
    ? (body.signDate ? new Date(String(body.signDate)) : null)
    : lead.signDate;
  // Ngày ký ở TƯƠNG LAI là không thể có thật — đã từng có 10 hợp đồng như vậy
  // lọt vào từ hai lô nhập Excel tháng 6/2026. Bỏ qua, giữ giá trị cũ.
  const requestedSignDate =
    rawSignDate && !isNaN(rawSignDate.getTime()) && rawSignDate.getTime() <= Date.now()
      ? rawSignDate
      : rawSignDate === null
        ? null
        : lead.signDate;
  const nextSignDate = (touchesFinance || (isAdmin && "signDate" in body))
    ? (nextRevenue ? (requestedSignDate ?? new Date()) : null)
    : lead.signDate;

  const updated = await prisma.salesLead.update({
    where: { id: params.id },
    data: {
      assignedPTId: newAssignedPTId,
      customerName: "customerName" in body ? String(body.customerName ?? "") : lead.customerName,
      yearOfBirth: "yearOfBirth" in body ? (body.yearOfBirth ? parseInt(String(body.yearOfBirth)) : null) : lead.yearOfBirth,
      phone: "phone" in body ? (body.phone ? String(body.phone) : null) : lead.phone,
      source: nextSource,
      referralSource: "referralSource" in body ? (body.referralSource ? String(body.referralSource) : null) : lead.referralSource,
      notes: "notes" in body ? (body.notes ? String(body.notes) : null) : lead.notes,
      forecast: "forecast" in body ? (body.forecast ? String(body.forecast) : null) : lead.forecast,
      status: nextStatus,
      packageRegistered: nextPackage,
      actualRevenue: nextRevenue,
      remainingPayment: nextRemaining,
      fitpartnerRevenue: "fitpartnerRevenue" in body ? (body.fitpartnerRevenue != null ? parseFloat(String(body.fitpartnerRevenue)) : null) : lead.fitpartnerRevenue,
      signDate: nextSignDate,
      remark: "remark" in body ? (body.remark ? String(body.remark) : null) : lead.remark,
    },
    include: {
      assignedPT: { select: { id: true, name: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (["PIF", "DE", "PB"].includes(updated.status) && updated.signDate) {
    if (newAssignedPTId) {
      await syncLeadRevenueToWeeklyActuals(newAssignedPTId, lead.branchId, lead.month, lead.year);
    }
    if (newAssignedPTId !== lead.assignedPTId && lead.assignedPTId) {
      await syncLeadRevenueToWeeklyActuals(lead.assignedPTId, lead.branchId, lead.month, lead.year);
    }
  }
  await syncLeadToTransaction(updated);

  // Auto-sync to client profile when status is PIF/DE/PB (skip leads with no PT assigned)
  let syncedClientId = updated.syncedClientId ?? null;
  if (["PIF", "DE", "PB"].includes(updated.status) && !syncedClientId && updated.assignedPTId) {
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

  // Chụp cả lead lẫn dòng thu chi sinh ra từ nó trước khi xóa.
  await captureTrash("SALES_LEAD", params.id, session.user);

  await prisma.transaction.deleteMany({ where: { referenceId: params.id } });
  await prisma.salesLead.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
