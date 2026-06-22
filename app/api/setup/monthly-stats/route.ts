export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LEAD_SOURCES as SOURCES } from "@/lib/lead-sources";

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
  // period: omitted/"month" → single month; "quarter" → 3 months; "year" → all 12.
  const period = searchParams.get("period");
  const quarter = parseInt(searchParams.get("quarter") ?? "0");

  const validQuarter = period !== "quarter" || (quarter >= 1 && quarter <= 4);
  if (!branchId || !year || (period !== "quarter" && period !== "year" && !month) || !validQuarter) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  if (isFM && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Which reporting months this period covers (SalesLead.month/year).
  const monthFilter =
    period === "year"
      ? { in: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }
      : period === "quarter"
        ? { in: [(quarter - 1) * 3 + 1, (quarter - 1) * 3 + 2, (quarter - 1) * 3 + 3] }
        : month;

  // All leads in the period (any status) — used for lead-source & profile analysis.
  const allLeads = await prisma.salesLead.findMany({
    where: {
      branchId,
      month: monthFilter,
      year,
      ...(isPT ? { assignedPTId: session.user.id } : {}),
    },
    select: {
      source: true,
      status: true,
      signDate: true,
      actualRevenue: true,
      yearOfBirth: true,
      assignedPTId: true,
      assignedPT: { select: { id: true, name: true, email: true, role: true } },
      consultation: { select: { info: { select: { currentWeight: true, height: true } } } },
    },
  });

  // A registered customer = bought a contract (deposit / paid-in-full / paid-remaining).
  // No signDate gate, so "đã chốt" counts every registered lead.
  const isWon = (l: (typeof allLeads)[number]) =>
    l.status === "PIF" || l.status === "DE" || l.status === "PB";

  const leads = allLeads.filter(isWon);

  const totalLeads = allLeads.length;
  const totalContracts = leads.length;
  // Revenue counts every lead in the month (matches Setup "Tổng doanh thu"), regardless
  // of status or sign date — a contract counts whether or not it was fully paid.
  const totalRevenue = allLeads.reduce((s, l) => s + (l.actualRevenue ?? 0), 0);

  // ── By source ────────────────────────────────────────────────────────────
  const sourceMap = new Map<string, { contracts: number; revenue: number }>();
  for (const lead of allLeads) {
    const key = lead.source?.trim() || "Không rõ nguồn";
    const cur = sourceMap.get(key) ?? { contracts: 0, revenue: 0 };
    cur.revenue += lead.actualRevenue ?? 0;
    if (isWon(lead)) cur.contracts += 1;
    sourceMap.set(key, cur);
  }

  const bySource = Array.from(sourceMap.entries())
    .filter(([, stat]) => stat.contracts > 0 || stat.revenue > 0)
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
    role: string;
    contracts: number;
    revenue: number;
    sources: Map<string, number>;
  }>();

  for (const lead of allLeads) {
    const ptId = lead.assignedPTId;
    // Lead không gắn PT (NS đã nghỉ) chỉ tính vào tổng doanh thu phòng tập, không vào "By PT".
    if (!ptId || !lead.assignedPT) continue;
    const ptName = lead.assignedPT.name ?? lead.assignedPT.email;
    const cur = ptMap.get(ptId) ?? { name: ptName, role: lead.assignedPT.role, contracts: 0, revenue: 0, sources: new Map() };
    cur.revenue += lead.actualRevenue ?? 0;
    if (isWon(lead)) {
      const src = lead.source?.trim() || "Không rõ nguồn";
      cur.contracts += 1;
      cur.sources.set(src, (cur.sources.get(src) ?? 0) + 1);
    }
    ptMap.set(ptId, cur);
  }

  const byPT = Array.from(ptMap.entries())
    .filter(([, stat]) => stat.contracts > 0 || stat.revenue > 0)
    .map(([ptId, stat]) => {
      let mainSource = "—";
      let maxCount = 0;
      stat.sources.forEach((count, src) => {
        if (count > maxCount) { maxCount = count; mainSource = src; }
      });
      return {
        ptId,
        ptName: stat.name,
        ptRole: stat.role,
        contracts: stat.contracts,
        revenue: stat.revenue,
        revenuePct: totalRevenue > 0 ? Math.round((stat.revenue / totalRevenue) * 1000) / 10 : 0,
        mainSource,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // ── By source (all leads + conversion) ───────────────────────────────────
  const sourceAllMap = new Map<string, { leads: number; contracts: number }>();
  for (const lead of allLeads) {
    const key = lead.source?.trim() || "Không rõ nguồn";
    const cur = sourceAllMap.get(key) ?? { leads: 0, contracts: 0 };
    cur.leads += 1;
    if (isWon(lead)) cur.contracts += 1;
    sourceAllMap.set(key, cur);
  }

  const bySourceAll = Array.from(sourceAllMap.entries())
    .filter(([, stat]) => stat.leads > 0)
    .map(([source, stat]) => ({
      source,
      leads: stat.leads,
      contracts: stat.contracts,
      leadPct: totalLeads > 0 ? Math.round((stat.leads / totalLeads) * 1000) / 10 : 0,
      conversionPct: stat.leads > 0 ? Math.round((stat.contracts / stat.leads) * 1000) / 10 : 0,
    }))
    .sort((a, b) => {
      const ai = SOURCES.indexOf(a.source);
      const bi = SOURCES.indexOf(b.source);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.source.localeCompare(b.source);
    });

  // ── Profile: age & weight buckets (leads vs won) ──────────────────────────
  const AGE_ORDER = ["≤ 24", "25–34", "35–44", "≥ 45", "Không rõ"];
  // Weight buckets reflect the gap to ideal weight: currentWeight(kg) − height(cm) + 100.
  const WEIGHT_ORDER = ["≥ 10 kg", "≥ 6 kg", "≥ 3 kg", "0 – 2.9 kg", "< 0 kg", "Không rõ"];

  const ageBucket = (yob: number | null): string => {
    if (!yob || yob < 1900 || yob > year) return "Không rõ";
    const age = year - yob;
    if (age <= 24) return "≤ 24";
    if (age <= 34) return "25–34";
    if (age <= 44) return "35–44";
    return "≥ 45";
  };
  const weightBucket = (w: number | null | undefined, h: number | null | undefined): string => {
    if (!w || w <= 0 || !h || h <= 0) return "Không rõ";
    const diff = w - h + 100; // gap to ideal weight (height − 100)
    if (diff >= 10) return "≥ 10 kg";
    if (diff >= 6) return "≥ 6 kg";
    if (diff >= 3) return "≥ 3 kg";
    if (diff >= 0) return "0 – 2.9 kg";
    return "< 0 kg";
  };

  const ageMap = new Map<string, { leads: number; contracts: number }>();
  const weightMap = new Map<string, { leads: number; contracts: number }>();
  for (const lead of allLeads) {
    const won = isWon(lead);
    const ab = ageBucket(lead.yearOfBirth);
    const ac = ageMap.get(ab) ?? { leads: 0, contracts: 0 };
    ac.leads += 1;
    if (won) ac.contracts += 1;
    ageMap.set(ab, ac);

    const wb = weightBucket(lead.consultation?.info?.currentWeight, lead.consultation?.info?.height);
    const wc = weightMap.get(wb) ?? { leads: 0, contracts: 0 };
    wc.leads += 1;
    if (won) wc.contracts += 1;
    weightMap.set(wb, wc);
  }

  const buildBuckets = (order: string[], map: Map<string, { leads: number; contracts: number }>) =>
    order
      .map((bucket) => {
        const stat = map.get(bucket) ?? { leads: 0, contracts: 0 };
        return {
          bucket,
          leads: stat.leads,
          contracts: stat.contracts,
          leadPct: totalLeads > 0 ? Math.round((stat.leads / totalLeads) * 1000) / 10 : 0,
          conversionPct: stat.leads > 0 ? Math.round((stat.contracts / stat.leads) * 1000) / 10 : 0,
        };
      })
      .filter((b) => b.leads > 0);

  const byAge = buildBuckets(AGE_ORDER, ageMap);
  const byWeight = buildBuckets(WEIGHT_ORDER, weightMap);

  return NextResponse.json({
    bySource,
    bySourceAll,
    byAge,
    byWeight,
    byPT,
    totalLeads,
    totalContracts,
    totalRevenue,
  });
}
