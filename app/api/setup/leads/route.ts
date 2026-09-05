import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncLeadRevenueToWeeklyActuals } from "@/lib/sync-revenue";
import { syncLeadToTransaction } from "@/lib/sync-finance";
import { validateLeadFinance, type LeadFinanceStatus } from "@/lib/lead-pricing";

const ALLOWED = ["ADMIN", "FM", "CEO_FITPARTNER", "COO", "PT"];

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !ALLOWED.includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const month = parseInt(searchParams.get("month") ?? "0");
  const year = parseInt(searchParams.get("year") ?? "0");

  if (!branchId || !month || !year) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const role = session.user.role;
  const isFM = role === "FM";
  const isPT = role === "PT";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (isFM && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where: Record<string, unknown> = { branchId, month, year };
  if (isPT) where.assignedPTId = session.user.id;

  const leads = await prisma.salesLead.findMany({
    where,
    include: {
      assignedPT: { select: { id: true, name: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ assignedPTId: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(leads);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "PT";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  // CEO_FitPartner chỉ được XEM lead — không được thêm. (COO ngang quyền Admin)
  if (role === "CEO_FITPARTNER") {
    return NextResponse.json({ error: "Không có quyền thêm lead" }, { status: 403 });
  }

  const body = await req.json();
  const { branchId, assignedPTId, customerName, yearOfBirth, phone, source, referralSource, notes,
    forecast, status, packageRegistered, actualRevenue, remainingPayment,
    fitpartnerRevenue, signDate, remark, month, year } = body;

  if (!branchId || !assignedPTId || !customerName || !month || !year) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }
  if (isFM && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (isPT && assignedPTId !== session.user.id) {
    return NextResponse.json({ error: "PT chỉ có thể thêm lead cho bản thân" }, { status: 403 });
  }

  // Doanh thu / Còn thiếu phải khớp bảng giá theo Tình trạng + Phân nguồn.
  const revenueNum   = actualRevenue != null && actualRevenue !== "" ? parseFloat(String(actualRevenue)) : null;
  const remainingNum = remainingPayment != null && remainingPayment !== "" ? parseFloat(String(remainingPayment)) : null;
  const moneyError = validateLeadFinance({
    status: (status || "TAKECARE") as LeadFinanceStatus,
    source: source || null,
    packageRegistered: packageRegistered || null,
    actualRevenue: revenueNum,
    remainingPayment: remainingNum,
  });
  if (moneyError) return NextResponse.json({ error: moneyError }, { status: 400 });

  // Ngày ký chạy theo ô Doanh thu: có tiền thì có ngày ký, chưa có tiền thì bỏ trống.
  // Chỉ Admin được đặt ngày cụ thể, và không nhận ngày ở tương lai — xem PUT.
  const askedSignDate = session.user.role === "ADMIN" && signDate ? new Date(signDate) : null;
  const validAsked =
    askedSignDate && !isNaN(askedSignDate.getTime()) && askedSignDate.getTime() <= Date.now()
      ? askedSignDate
      : null;
  const resolvedSignDate = revenueNum ? (validAsked ?? new Date()) : null;

  const lead = await prisma.salesLead.create({
    data: {
      branchId, assignedPTId, createdById: session.user.id,
      customerName, yearOfBirth: yearOfBirth ? parseInt(yearOfBirth) : null,
      phone: phone || null, source: source || null,
      referralSource: source === "Referral" ? (referralSource || null) : null,
      notes: notes || null,
      forecast: forecast || null, status: status || "TAKECARE",
      packageRegistered: packageRegistered || null,
      actualRevenue: revenueNum,
      remainingPayment: remainingNum,
      fitpartnerRevenue: fitpartnerRevenue ? parseFloat(fitpartnerRevenue) : null,
      signDate: resolvedSignDate,
      remark: remark || null, month: parseInt(month), year: parseInt(year),
    },
    include: {
      assignedPT: { select: { id: true, name: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (lead.assignedPTId && ["PIF", "DE", "PB"].includes(lead.status) && lead.signDate) {
    await syncLeadRevenueToWeeklyActuals(lead.assignedPTId, lead.branchId, lead.month, lead.year);
  }
  await syncLeadToTransaction(lead);

  return NextResponse.json(lead, { status: 201 });
}
