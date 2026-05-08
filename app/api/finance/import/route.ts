import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";

type TxInput = {
  transactionDate: string; // ISO date "YYYY-MM-DD"
  category:        string;
  amount:          number;
  description?:    string;
};

type ImportBody = {
  type:             "income" | "expense";
  branchId:         string;
  dryRun?:          boolean;
  forceDuplicates?: boolean;
  transactions:     TxInput[];
};

function canAccess(role: string, branchId: string, managed: string[]) {
  if (role === "ADMIN" || role === "CEO_FITPARTNER") return true;
  if (role === "FM") return managed.includes(branchId);
  return false;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role    = session.user.role;
  const managed: string[] = session.user.managedBranchIds ?? [];

  let body: ImportBody;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { type, branchId, dryRun = false, forceDuplicates = false, transactions } = body;

  if (!canAccess(role, branchId, managed)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!Array.isArray(transactions) || transactions.length === 0) {
    if (dryRun) return NextResponse.json({ duplicateIndices: [] });
    return NextResponse.json({ imported: 0, skipped: 0 });
  }

  if (transactions.length > 500) {
    return NextResponse.json({ error: "Tối đa 500 hàng mỗi lần nhập" }, { status: 400 });
  }

  const txType = type === "income" ? "INCOME" : "EXPENSE";

  // Build date range for efficient lookup
  const dates = transactions
    .map(t => new Date(t.transactionDate))
    .filter(d => !isNaN(d.getTime()));

  if (dates.length === 0) {
    if (dryRun) return NextResponse.json({ duplicateIndices: [] });
    return NextResponse.json({ imported: 0, skipped: transactions.length });
  }

  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  minDate.setDate(minDate.getDate() - 1);
  maxDate.setDate(maxDate.getDate() + 1);

  const existing = await prisma.transaction.findMany({
    where: {
      branchId,
      type:            txType,
      transactionDate: { gte: minDate, lte: maxDate },
    },
    select: { transactionDate: true, amount: true, description: true },
  });

  const existingSet = new Set(
    existing.map(e =>
      `${e.transactionDate.toISOString().split("T")[0]}|${e.amount}|${e.description ?? ""}`
    )
  );

  const dupeKey = (t: TxInput) =>
    `${t.transactionDate}|${t.amount}|${t.description ?? ""}`;

  if (dryRun) {
    const duplicateIndices = transactions
      .map((t, i) => (existingSet.has(dupeKey(t)) ? i : -1))
      .filter(i => i !== -1);
    return NextResponse.json({ duplicateIndices });
  }

  // Actual import
  const toCreate: TxInput[] = [];
  let skipped = 0;
  for (const tx of transactions) {
    if (!forceDuplicates && existingSet.has(dupeKey(tx))) {
      skipped++;
    } else {
      toCreate.push(tx);
    }
  }

  if (toCreate.length > 0) {
    await prisma.transaction.createMany({
      data: toCreate.map(tx => ({
        branchId,
        type:            txType,
        category:        tx.category,
        amount:          tx.amount,
        description:     tx.description ?? null,
        transactionDate: new Date(tx.transactionDate),
        createdById:     session.user.id,
      })),
    });
  }

  return NextResponse.json({ imported: toCreate.length, skipped });
}
