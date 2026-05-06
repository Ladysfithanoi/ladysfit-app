import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const yearStr  = searchParams.get("year");
  const year     = yearStr ? parseInt(yearStr) : 0;
  const monthStr = searchParams.get("month");
  const month    = monthStr ? parseInt(monthStr) : null;
  const period   = searchParams.get("period") ?? "monthly";
  const fromYear = parseInt(searchParams.get("fromYear") ?? String(year));
  const toYear   = parseInt(searchParams.get("toYear")   ?? String(year));

  if (!branchId) return NextResponse.json({ error: "Missing branchId" }, { status: 400 });

  const role    = session.user.role;
  const managed: string[] = session.user.managedBranchIds ?? [];
  if (role === "FREE" || role === "RESTRICTED") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (role === "FM" && !managed.includes(branchId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // ── Daily view ────────────────────────────────────────────────────────────
  if (month && year) {
    const start       = new Date(year, month - 1, 1);
    const end         = new Date(year, month, 1);
    const daysInMonth = new Date(year, month, 0).getDate();

    const rows = await prisma.transaction.findMany({
      where: { branchId, transactionDate: { gte: start, lt: end } },
      select: { type: true, amount: true, transactionDate: true },
    });

    const byDay: Record<number, { income: number; expense: number }> = {};
    for (const r of rows) {
      const d = new Date(r.transactionDate).getDate();
      if (!byDay[d]) byDay[d] = { income: 0, expense: 0 };
      if (r.type === "INCOME") byDay[d].income += r.amount;
      else byDay[d].expense += r.amount;
    }

    let running = 0;
    const result = Array.from({ length: daysInMonth }, (_, i) => {
      const day     = i + 1;
      const income  = byDay[day]?.income  ?? 0;
      const expense = byDay[day]?.expense ?? 0;
      running += income - expense;
      return { day, income, expense, balance: running };
    });

    return NextResponse.json(result);
  }

  // ── Quarterly view ────────────────────────────────────────────────────────
  if (period === "quarterly") {
    if (!year) return NextResponse.json({ error: "Missing year" }, { status: 400 });

    const start = new Date(year, 0, 1);
    const end   = new Date(year + 1, 0, 1);

    const rows = await prisma.transaction.findMany({
      where: { branchId, transactionDate: { gte: start, lt: end } },
      select: { type: true, amount: true, transactionDate: true },
    });

    const byQ: Record<number, { income: number; expense: number }> = {
      1: { income: 0, expense: 0 },
      2: { income: 0, expense: 0 },
      3: { income: 0, expense: 0 },
      4: { income: 0, expense: 0 },
    };

    for (const r of rows) {
      const m = new Date(r.transactionDate).getMonth() + 1;
      const q = Math.ceil(m / 3);
      if (r.type === "INCOME") byQ[q].income += r.amount;
      else byQ[q].expense += r.amount;
    }

    const QUARTER_MONTHS: Record<number, string> = {
      1: "Tháng 1 – 3",
      2: "Tháng 4 – 6",
      3: "Tháng 7 – 9",
      4: "Tháng 10 – 12",
    };

    const result = [1, 2, 3, 4].map(q => ({
      quarter: q,
      months:  QUARTER_MONTHS[q],
      income:  byQ[q].income,
      expense: byQ[q].expense,
      profit:  byQ[q].income - byQ[q].expense,
    }));

    return NextResponse.json(result);
  }

  // ── Yearly view ───────────────────────────────────────────────────────────
  if (period === "yearly") {
    if (!fromYear || !toYear) return NextResponse.json({ error: "Missing fromYear/toYear" }, { status: 400 });

    const fetchFrom = fromYear - 1; // one extra year for growth calculation
    const start = new Date(fetchFrom, 0, 1);
    const end   = new Date(toYear + 1, 0, 1);

    const rows = await prisma.transaction.findMany({
      where: { branchId, transactionDate: { gte: start, lt: end } },
      select: { type: true, amount: true, transactionDate: true },
    });

    const byYear: Record<number, { income: number; expense: number }> = {};
    for (const r of rows) {
      const y = new Date(r.transactionDate).getFullYear();
      if (!byYear[y]) byYear[y] = { income: 0, expense: 0 };
      if (r.type === "INCOME") byYear[y].income += r.amount;
      else byYear[y].expense += r.amount;
    }

    const result = [];
    for (let y = fromYear; y <= toYear; y++) {
      const income    = byYear[y]?.income  ?? 0;
      const expense   = byYear[y]?.expense ?? 0;
      const profit    = income - expense;
      const prevProfit = (byYear[y - 1]?.income ?? 0) - (byYear[y - 1]?.expense ?? 0);
      const growth    = prevProfit !== 0 ? ((profit - prevProfit) / Math.abs(prevProfit)) * 100 : null;
      result.push({ year: y, income, expense, profit, growth });
    }

    return NextResponse.json(result);
  }

  // ── Monthly view (default) ────────────────────────────────────────────────
  if (!year) return NextResponse.json({ error: "Missing year" }, { status: 400 });

  const start = new Date(year, 0, 1);
  const end   = new Date(year + 1, 0, 1);

  const rows = await prisma.transaction.findMany({
    where: { branchId, transactionDate: { gte: start, lt: end } },
    select: { type: true, amount: true, transactionDate: true },
  });

  const byMonth: Record<number, { income: number; expense: number }> = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = { income: 0, expense: 0 };

  for (const r of rows) {
    const m = new Date(r.transactionDate).getMonth() + 1;
    if (r.type === "INCOME") byMonth[m].income += r.amount;
    else byMonth[m].expense += r.amount;
  }

  const result = Array.from({ length: 12 }, (_, i) => {
    const m       = i + 1;
    const income  = byMonth[m].income;
    const expense = byMonth[m].expense;
    const profit  = income - expense;
    return { month: m, income, expense, profit };
  });

  return NextResponse.json(result);
}
