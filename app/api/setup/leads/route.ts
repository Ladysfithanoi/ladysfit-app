import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncLeadRevenueToWeeklyActuals } from "@/lib/sync-revenue";
import { syncLeadToTransaction } from "@/lib/sync-finance";

const ALLOWED = ["ADMIN", "FM", "CEO_FITPARTNER", "COO", "FREE", "RESTRICTED"];

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
  const isPT = role === "FREE" || role === "RESTRICTED";
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
  const isPT = role === "FREE" || role === "RESTRICTED";
  const isFM = role === "FM";
  const isAdmin = role === "ADMIN";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (isAdmin || isFM || role === "CEO_FITPARTNER" || role === "COO") {
    return NextResponse.json({ error: "Chỉ PT mới có thể thêm lead" }, { status: 403 });
  }

  const body = await req.json();
  const { branchId, assignedPTId, customerName, yearOfBirth, phone, source, notes,
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

  const lead = await prisma.salesLead.create({
    data: {
      branchId, assignedPTId, createdById: session.user.id,
      customerName, yearOfBirth: yearOfBirth ? parseInt(yearOfBirth) : null,
      phone: phone || null, source: source || null, notes: notes || null,
      forecast: forecast || null, status: status || "TAKECARE",
      packageRegistered: packageRegistered || null,
      actualRevenue: actualRevenue ? parseFloat(actualRevenue) : null,
      remainingPayment: remainingPayment ? parseFloat(remainingPayment) : null,
      fitpartnerRevenue: fitpartnerRevenue ? parseFloat(fitpartnerRevenue) : null,
      signDate: signDate ? new Date(signDate) : null,
      remark: remark || null, month: parseInt(month), year: parseInt(year),
    },
    include: {
      assignedPT: { select: { id: true, name: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (["PIF", "DE", "PB"].includes(lead.status) && lead.signDate) {
    await syncLeadRevenueToWeeklyActuals(lead.assignedPTId, lead.branchId, lead.month, lead.year);
  }
  await syncLeadToTransaction(lead);

  return NextResponse.json(lead, { status: 201 });
}
