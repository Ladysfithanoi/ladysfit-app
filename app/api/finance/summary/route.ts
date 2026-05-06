import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const month    = parseInt(searchParams.get("month") ?? "0");
  const year     = parseInt(searchParams.get("year")  ?? "0");

  if (!branchId || !month || !year) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const role    = session.user.role;
  const managed: string[] = session.user.managedBranchIds ?? [];
  if (role === "FREE" || role === "RESTRICTED") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (role === "FM" && !managed.includes(branchId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1);

  const [incomeAgg, expenseAgg, byCategory] = await Promise.all([
    prisma.transaction.aggregate({
      where: { branchId, type: "INCOME", transactionDate: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { branchId, type: "EXPENSE", transactionDate: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["type", "category"],
      where: { branchId, transactionDate: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
  ]);

  const totalIncome  = incomeAgg._sum.amount  ?? 0;
  const totalExpense = expenseAgg._sum.amount ?? 0;
  const profit       = totalIncome - totalExpense;
  const profitRate   = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

  return NextResponse.json({
    totalIncome,
    totalExpense,
    profit,
    profitRate,
    byCategory: byCategory.map(g => ({ type: g.type, category: g.category, total: g._sum.amount ?? 0 })),
  });
}
