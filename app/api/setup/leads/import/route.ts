import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeadStatus } from "@prisma/client";
import { syncLeadRevenueToWeeklyActuals } from "@/lib/sync-revenue";
import { syncLeadToTransaction } from "@/lib/sync-finance";

const ALLOWED = ["ADMIN", "FM", "CEO_FITPARTNER", "COO", "PT"];
const VALID_STATUS: LeadStatus[] = ["TAKECARE", "FAIL", "DE", "PIF", "PB"];
const REGISTERED = ["PIF", "DE", "PB"];

type ImportRow = {
  customerName?: string;
  month?: number | string;
  year?: number | string;
  assignedPTId?: string;
  ptName?: string; // tên nhân sự gõ trong Excel — server tự resolve (nguồn chuẩn)
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

// Chuẩn hóa tên để so khớp: bỏ dấu, đ→d, gộp khoảng trắng, viết thường.
function normalizeName(s: string): string {
  return s.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
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

  // Resolve which staff the caller can assign leads to (one branch query). Build a
  // name/email → id map so we can resolve names server-side — the client's staff
  // list can be stale or missing an FM, which previously made FM rows fail to import.
  const allowedPTs = new Set<string>();
  const nameToId = new Map<string, string>();
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
      select: { id: true, name: true, email: true },
    });
    for (const s of staff) {
      allowedPTs.add(s.id);
      if (s.name) nameToId.set(normalizeName(s.name), s.id);
      if (s.email) nameToId.set(normalizeName(s.email), s.id);
    }
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

    if (!customerName) { errors.push({ row: rowNo, message: "Thiếu tên khách hàng" }); continue; }
    if (!month || month < 1 || month > 12) { errors.push({ row: rowNo, message: "Tháng không hợp lệ" }); continue; }
    if (!year) { errors.push({ row: rowNo, message: "Thiếu năm" }); continue; }

    // Resolve nhân sự: ưu tiên id do client gửi (nếu hợp lệ), nếu không thì khớp theo
    // tên/email server-side. Bỏ trống = lead của NS đã nghỉ → doanh thu về phòng tập.
    let assignedPTId: string | null;
    if (isPT) {
      assignedPTId = session.user.id;
    } else {
      const hint = String(r.assignedPTId ?? "").trim();
      const ptName = String(r.ptName ?? "").trim();
      if (hint && allowedPTs.has(hint)) {
        assignedPTId = hint;
      } else if (ptName) {
        const found = nameToId.get(normalizeName(ptName));
        if (!found) { errors.push({ row: rowNo, message: `Không tìm thấy nhân sự "${ptName}"` }); continue; }
        assignedPTId = found;
      } else {
        assignedPTId = null;
      }
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
