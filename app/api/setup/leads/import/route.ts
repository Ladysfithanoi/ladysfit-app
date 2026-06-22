import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeadStatus } from "@prisma/client";
import { syncLeadRevenueToWeeklyActuals } from "@/lib/sync-revenue";
import { syncLeadToTransaction } from "@/lib/sync-finance";

const ALLOWED = ["ADMIN", "FM", "COO", "PT"];
const VALID_STATUS: LeadStatus[] = ["TAKECARE", "FAIL", "DE", "PIF", "PB"];
const REGISTERED = ["PIF", "DE", "PB"];

type ImportRow = {
  customerName?: string;
  month?: number | string;
  year?: number | string;
  assignedPTId?: string;
  yearOfBirth?: number | string | null;
  phone?: string | null;
  source?: string | null;
  referralSource?: string | null;
  forecast?: string | null;
  status?: string;
  packageRegistered?: string | null;
  actualRevenue?: number | string | null;
  remainingPayment?: number | string | null;
  fitpartnerRevenue?: number | string | null;
  signDate?: string | null;
  notes?: string | null;
  remark?: string | null;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !ALLOWED.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  const isPT = role === "PT";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  const body = await req.json();
  const { branchId, leads } = body as { branchId?: string; leads?: ImportRow[] };

  if (!branchId || !Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: "Thiếu dữ liệu nhập" }, { status: 400 });
  }
  if (isFM && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Resolve which PTs the caller is allowed to assign leads to (one branch query).
  const allowedPTs = new Set<string>();
  if (isPT) {
    allowedPTs.add(session.user.id);
  } else {
    const staff = await prisma.user.findMany({
      where: {
        deletedAt: null,
        role: { in: ["PT", "FM", "ADMIN"] },
        OR: [
          { branchId },
          { role: "FM", managedBranches: { some: { branchId } } },
        ],
      },
      select: { id: true },
    });
    staff.forEach((s) => allowedPTs.add(s.id));
  }

  let imported = 0;
  const errors: { row: number; message: string }[] = [];
  const revenueSyncKeys = new Set<string>(); // `${ptId}|${month}|${year}`

  for (let i = 0; i < leads.length; i++) {
    const r = leads[i];
    const rowNo = i + 1;

    const customerName = String(r.customerName ?? "").trim();
    const month = parseInt(String(r.month ?? ""));
    const year = parseInt(String(r.year ?? ""));
    // Blank staff (e.g. lead của PT đã nghỉ việc) → null: doanh thu về thẳng phòng tập.
    const rawPT = String(r.assignedPTId ?? "").trim();
    const assignedPTId = isPT ? session.user.id : (rawPT || null);

    if (!customerName) { errors.push({ row: rowNo, message: "Thiếu tên khách hàng" }); continue; }
    if (!month || month < 1 || month > 12) { errors.push({ row: rowNo, message: "Tháng không hợp lệ" }); continue; }
    if (!year) { errors.push({ row: rowNo, message: "Thiếu năm" }); continue; }
    if (assignedPTId && !allowedPTs.has(assignedPTId)) {
      errors.push({ row: rowNo, message: "Nhân sự phụ trách không hợp lệ" });
      continue;
    }

    const status: LeadStatus = VALID_STATUS.includes(String(r.status) as LeadStatus)
      ? (String(r.status) as LeadStatus)
      : "TAKECARE";
    const source = r.source ? String(r.source).trim() : null;
    const signDate = r.signDate ? new Date(r.signDate) : null;

    try {
      const lead = await prisma.salesLead.create({
        data: {
          branchId,
          assignedPTId,
          createdById: session.user.id,
          customerName,
          yearOfBirth: r.yearOfBirth ? parseInt(String(r.yearOfBirth)) || null : null,
          phone: r.phone ? String(r.phone).trim() : null,
          source,
          referralSource: source === "Referral" && r.referralSource ? String(r.referralSource).trim() : null,
          notes: r.notes ? String(r.notes).trim() : null,
          forecast: r.forecast ? String(r.forecast).trim() : null,
          status,
          packageRegistered: r.packageRegistered ? String(r.packageRegistered).trim() : null,
          actualRevenue: num(r.actualRevenue),
          remainingPayment: num(r.remainingPayment),
          fitpartnerRevenue: num(r.fitpartnerRevenue),
          signDate: signDate && !isNaN(signDate.getTime()) ? signDate : null,
          remark: r.remark ? String(r.remark).trim() : null,
          month,
          year,
        },
        include: { assignedPT: { select: { name: true } } },
      });
      imported++;

      if (lead.assignedPTId && REGISTERED.includes(lead.status) && lead.signDate) {
        revenueSyncKeys.add(`${lead.assignedPTId}|${lead.month}|${lead.year}`);
      }
      await syncLeadToTransaction(lead);
    } catch (err) {
      console.error("[setup/leads/import] row", rowNo, err);
      errors.push({ row: rowNo, message: "Lỗi khi lưu dòng này" });
    }
  }

  // Recompute weekly revenue actuals once per affected (PT, month, year).
  for (const key of Array.from(revenueSyncKeys)) {
    const [ptId, m, y] = key.split("|");
    await syncLeadRevenueToWeeklyActuals(ptId, branchId, parseInt(m), parseInt(y));
  }

  return NextResponse.json({ imported, skipped: errors.length, errors });
}
