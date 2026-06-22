export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Sales target for one PT: 38 triệu/tháng (used to score work performance).
const PT_MONTHLY_TARGET = 38;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "PT";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const year = parseInt(searchParams.get("year") ?? "0");

  if (!branchId || !year) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  if (isFM && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pull every lead in the whole year so the client can slice by month/quarter/year
  // without refetching. PT only sees their own data.
  const leads = await prisma.salesLead.findMany({
    where: {
      branchId,
      year,
      ...(isPT ? { assignedPTId: session.user.id } : {}),
    },
    select: {
      month: true,
      status: true,
      actualRevenue: true,
      assignedPTId: true,
      assignedPT: { select: { id: true, name: true, email: true } },
    },
  });

  // A "khách hàng" (transform) = lead that bought a contract.
  const isWon = (l: (typeof leads)[number]) =>
    l.status === "PIF" || l.status === "DE" || l.status === "PB";

  // ptId → name + 12-month arrays of revenue / customers / leads.
  const ptMap = new Map<string, {
    name: string;
    revenue: number[];   // index 0 = tháng 1
    customers: number[];
    leads: number[];
  }>();

  for (const lead of leads) {
    const ptId = lead.assignedPTId;
    const name = lead.assignedPT.name ?? lead.assignedPT.email;
    const cur = ptMap.get(ptId) ?? {
      name,
      revenue: Array(12).fill(0),
      customers: Array(12).fill(0),
      leads: Array(12).fill(0),
    };
    const m = lead.month - 1;
    if (m >= 0 && m < 12) {
      cur.revenue[m] += lead.actualRevenue ?? 0;
      cur.leads[m] += 1;
      if (isWon(lead)) cur.customers[m] += 1;
    }
    ptMap.set(ptId, cur);
  }

  const personnel = Array.from(ptMap.entries())
    .map(([ptId, stat]) => ({
      ptId,
      ptName: stat.name,
      revenue: stat.revenue,
      customers: stat.customers,
      leads: stat.leads,
    }))
    // Drop personnel with no activity at all in the year.
    .filter((p) =>
      p.revenue.some((v) => v > 0) || p.leads.some((v) => v > 0)
    )
    .sort((a, b) => {
      const ar = a.revenue.reduce((s, v) => s + v, 0);
      const br = b.revenue.reduce((s, v) => s + v, 0);
      return br - ar;
    });

  return NextResponse.json({ year, target: PT_MONTHLY_TARGET, personnel });
}
