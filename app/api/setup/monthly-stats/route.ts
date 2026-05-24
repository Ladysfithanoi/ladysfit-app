import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SOURCES = ["Facebook Page", "Referral", "Tiktok", "Zalo", "Outdoor", "Website", "Renew", "Referral.PT", "Walk-in", "Thương hiệu cá nhân"];

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "PT";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const month = parseInt(searchParams.get("month") ?? "0");
  const year = parseInt(searchParams.get("year") ?? "0");

  if (!branchId || !month || !year) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  if (isFM && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const leads = await prisma.salesLead.findMany({
    where: {
      branchId,
      month,
      year,
      status: { in: ["PIF", "DE", "PB"] },
      signDate: { not: null },
      ...(isPT ? { assignedPTId: session.user.id } : {}),
    },
    select: {
      source: true,
      actualRevenue: true,
      assignedPTId: true,
      assignedPT: { select: { id: true, name: true, email: true } },
    },
  });

  const totalContracts = leads.length;
  const totalRevenue = leads.reduce((s, l) => s + (l.actualRevenue ?? 0), 0);

  // ── By source ────────────────────────────────────────────────────────────
  const sourceMap = new Map<string, { contracts: number; revenue: number }>();
  for (const lead of leads) {
    const key = lead.source?.trim() || "Không rõ nguồn";
    const cur = sourceMap.get(key) ?? { contracts: 0, revenue: 0 };
    sourceMap.set(key, { contracts: cur.contracts + 1, revenue: cur.revenue + (lead.actualRevenue ?? 0) });
  }

  const bySource = Array.from(sourceMap.entries())
    .filter(([, stat]) => stat.contracts > 0)
    .map(([source, stat]) => ({
      source,
      contracts: stat.contracts,
      revenue: stat.revenue,
      contractPct: totalContracts > 0 ? Math.round((stat.contracts / totalContracts) * 1000) / 10 : 0,
      revenuePct: totalRevenue > 0 ? Math.round((stat.revenue / totalRevenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => {
      const ai = SOURCES.indexOf(a.source);
      const bi = SOURCES.indexOf(b.source);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.source.localeCompare(b.source);
    });

  // ── By PT ────────────────────────────────────────────────────────────────
  const ptMap = new Map<string, {
    name: string;
    contracts: number;
    revenue: number;
    sources: Map<string, number>;
  }>();

  for (const lead of leads) {
    const ptId = lead.assignedPTId;
    const ptName = lead.assignedPT.name ?? lead.assignedPT.email;
    const cur = ptMap.get(ptId) ?? { name: ptName, contracts: 0, revenue: 0, sources: new Map() };
    const src = lead.source?.trim() || "Không rõ nguồn";
    cur.contracts += 1;
    cur.revenue += lead.actualRevenue ?? 0;
    cur.sources.set(src, (cur.sources.get(src) ?? 0) + 1);
    ptMap.set(ptId, cur);
  }

  const byPT = Array.from(ptMap.entries())
    .map(([ptId, stat]) => {
      let mainSource = "—";
      let maxCount = 0;
      stat.sources.forEach((count, src) => {
        if (count > maxCount) { maxCount = count; mainSource = src; }
      });
      return {
        ptId,
        ptName: stat.name,
        contracts: stat.contracts,
        revenue: stat.revenue,
        revenuePct: totalRevenue > 0 ? Math.round((stat.revenue / totalRevenue) * 1000) / 10 : 0,
        mainSource,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({ bySource, byPT, totalContracts, totalRevenue });
}
