import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncLeadToTransaction } from "@/lib/sync-finance";

function canAccess(role: string, branchId: string, managedBranchIds: string[]) {
  if (role === "ADMIN" || role === "CEO_FITPARTNER") return true;
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

  // Auto-sync: create any missing INCOME transactions for qualifying leads in this month/year.
  // Runs in O(2 queries) when everything is already synced (the common path).
  {
    const qualifyingIds = (await prisma.salesLead.findMany({
      where: { branchId, month, year, status: { in: ["PIF", "DE", "PB"] }, actualRevenue: { gt: 0 } },
      select: { id: true },
    })).map(l => l.id);

    if (qualifyingIds.length > 0) {
      const syncedIds = new Set(
        (await prisma.transaction.findMany({
          where: { referenceId: { in: qualifyingIds } },
          select: { referenceId: true },
        })).map(t => t.referenceId!)
      );
      const missing = qualifyingIds.filter(id => !syncedIds.has(id));
      if (missing.length > 0) {
        const toSync = await prisma.salesLead.findMany({
          where: { id: { in: missing } },
          include: { assignedPT: { select: { name: true } } },
        });
        for (const lead of toSync) await syncLeadToTransaction(lead);
      }
    }
  }

  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1);

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
    category: string;
    amount: number;
    description?: string;
    transactionDate: string;
    receiptImages?: string;
  };

  if (!managed.includes(body.branchId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tx = await prisma.transaction.create({
    data: {
      branchId:        body.branchId,
      type:            body.type,
      category:        body.category,
      amount:          body.amount,
      description:     body.description ?? null,
      transactionDate: new Date(body.transactionDate),
      receiptImages:   body.receiptImages ?? null,
      createdById:     session.user.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(tx, { status: 201 });
}
