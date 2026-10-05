import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncMissingLeadIncome } from "@/lib/sync-finance";
import { vnMonthStart } from "@/lib/format-date";

function canAccess(role: string, branchId: string, managedBranchIds: string[]) {
  if (role === "ADMIN" || role === "CEO_FITPARTNER" || role === "COO") return true;
  if (role === "FM") return managedBranchIds.includes(branchId);
  return false;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const month    = parseInt(searchParams.get("month") ?? "0");
  const year     = parseInt(searchParams.get("year")  ?? "0");
  const type     = searchParams.get("type");

  if (!branchId || !month || !year) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const role = session.user.role;
  const managed: string[] = session.user.managedBranchIds ?? [];
  if (!canAccess(role, branchId, managed)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Tạo dòng thu còn thiếu cho lead có doanh thu — file Excel gọi đúng hàm này.
  await syncMissingLeadIncome(branchId, month, year);

  const start = vnMonthStart(year, month);
  const end   = vnMonthStart(year, month + 1);

  const transactions = await prisma.transaction.findMany({
    where: {
      branchId,
      transactionDate: { gte: start, lt: end },
      ...(type === "INCOME" || type === "EXPENSE" ? { type } : {}),
    },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { transactionDate: "desc" },
  });

  return NextResponse.json(transactions);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const managed: string[] = session.user.managedBranchIds ?? [];
  if (role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    branchId: string;
    type: "INCOME" | "EXPENSE";
    category?: string;
    amount: number;
    description?: string;
    transactionDate: string;
    receiptImages?: string;
    invoiceImages?: string;
  };

  if (!managed.includes(body.branchId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tx = await prisma.transaction.create({
    data: {
      branchId:        body.branchId,
      type:            body.type,
      category:        body.category ?? "Chi phí",
      amount:          body.amount,
      description:     body.description ?? null,
      transactionDate: new Date(body.transactionDate),
      receiptImages:   body.receiptImages ?? null,
      invoiceImages:   body.invoiceImages ?? null,
      createdById:     session.user.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(tx, { status: 201 });
}
