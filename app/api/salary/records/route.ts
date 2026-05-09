import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── KOC commission helper ──────────────────────────────────────────────────

function calculateKOCCommission(startWeight: number, endWeight: number | null, sessions: number): number {
  if (endWeight == null) return 0;
  const weightLost = startWeight - endWeight;
  const maxSessions = Math.min(sessions, 60);
  if (startWeight < 70) return 0;
  if (weightLost >= 8 && weightLost <= 9.9) return maxSessions * 35_000;
  if (weightLost >= 5 && weightLost <= 7.9) return maxSessions * 25_000;
  if (weightLost >= 3 && weightLost <= 4.9) return maxSessions * 20_000;
  return 0;
}

async function fetchKOCKOLCommission(ptId: string): Promise<{ kocCommission: number; kolCommission: number; kocContracts: number; kolSessions: number }> {
  const kocRows = await prisma.$queryRawUnsafe<{
    start_weight: number;
    end_weight: number | null;
    end_weight_confirmed: boolean;
    total_sessions: number;
    contract_type: string;
  }[]>(
    `
    SELECT k.start_weight, k.end_weight, k.end_weight_confirmed, k.total_sessions,
           pe.contract_type
    FROM koc_contracts k
    JOIN package_enrollments pe ON pe.id = k.enrollment_id
    WHERE k.pt_id = $1 AND k.status = 'COMPLETED' AND pe.status = 'ACTIVE'
    `,
    ptId
  );

  let kocCommission = 0;
  let kocContracts = 0;
  for (const row of kocRows) {
    if (row.contract_type === "KOC" && row.end_weight_confirmed) {
      kocCommission += calculateKOCCommission(Number(row.start_weight), row.end_weight != null ? Number(row.end_weight) : null, Number(row.total_sessions));
      kocContracts++;
    }
  }

  // KOL: count sessions for active KOL packages this month (we use total_sessions on the KOC contract for KOL too)
  const kolRows = await prisma.$queryRawUnsafe<{ total_sessions: number }[]>(
    `
    SELECT COALESCE(SUM(pe.sessions_used), 0)::int AS total_sessions
    FROM package_enrollments pe
    JOIN clients c ON c.id = pe.client_id
    WHERE c.assigned_pt_id = $1 AND pe.contract_type = 'KOL' AND pe.status = 'ACTIVE'
    `,
    ptId
  );

  const kolSessions = kolRows[0] ? Number(kolRows[0].total_sessions) : 0;
  const kolCommission = kolSessions * 60_000;

  return { kocCommission, kolCommission, kocContracts, kolSessions };
}

// ── Fixed company-wide tiers ───────────────────────────────────────────────

const PT_TIERS  = [
  { min: 86_000_000,  rate: 0.04  },
  { min: 60_000_000,  rate: 0.035 },
  { min: 38_000_000,  rate: 0.025 },
  { min: 0,           rate: 0.01  },
];

const FM_TIERS = [
  { min: 200_000_001, rate: 0.02  },
  { min: 140_000_001, rate: 0.015 },
  { min: 100_000_000, rate: 0.01  },
  { min: 0,           rate: 0     },
];

function ptRate(revenue: number)  { return PT_TIERS.find(t => revenue >= t.min)!.rate; }
function fmRate(revenue: number)  { return FM_TIERS.find(t => revenue >= t.min)!.rate; }

// ── GET — fetch records for FM, recalculating revenue live ─────────────────

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const month    = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year     = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
  if (branchId && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branchFilter = branchId ? [branchId] : managedBranchIds;

  const records = await prisma.salaryRecord.findMany({
    where: { branchId: { in: branchFilter }, month, year },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: [{ user: { role: "asc" } }, { user: { name: "asc" } }],
  });

  if (records.length === 0) return NextResponse.json(records);

  // Fresh branch revenue (VND) per branchId — used for FM commission
  const uniqueBranchIds = Array.from(new Set(records.map(r => r.branchId)));
  const branchRevenueMap: Record<string, number> = {};
  await Promise.all(uniqueBranchIds.map(async (bid) => {
    const agg = await prisma.salesLead.aggregate({
      where: { branchId: bid, month, year, status: { in: ["PIF", "DE", "PB"] } },
      _sum: { actualRevenue: true },
    });
    branchRevenueMap[bid] = Number(agg._sum.actualRevenue ?? 0) * 1_000_000;
  }));

  // Fresh individual revenue (VND) per user — used for PT/ADMIN commission
  const ptAdminRecords = records.filter(r => r.user.role !== "FM");
  const ptRevenueMap: Record<string, number> = {};
  await Promise.all(ptAdminRecords.map(async (r) => {
    const agg = await prisma.salesLead.aggregate({
      where: { assignedPTId: r.userId, month, year, status: { in: ["PIF", "DE", "PB"] } },
      _sum: { actualRevenue: true },
    });
    ptRevenueMap[r.userId] = Number(agg._sum.actualRevenue ?? 0) * 1_000_000;
  }));

  // Recalculate and patch each record where revenue-derived values changed
  const updated = await Promise.all(records.map(async (r) => {
    const role = r.user.role;

    const totalRevenue = role === "FM"
      ? (branchRevenueMap[r.branchId] ?? 0)
      : (ptRevenueMap[r.userId] ?? 0);

    const rate           = role === "FM" ? fmRate(totalRevenue) : ptRate(totalRevenue);
    const commissionRate   = rate * 100;
    const commissionAmount = totalRevenue * rate;

    // Fetch KOC/KOL commission for PT/ADMIN roles
    const { kocCommission, kolCommission } = (role !== "FM")
      ? await fetchKOCKOLCommission(r.userId)
      : { kocCommission: 0, kolCommission: 0 };

    let totalSalary: number;
    if (role === "FM") {
      totalSalary = r.baseSalary + r.fixedAllowances + r.seniorityBonus +
                    commissionAmount + r.showPay + r.googleBonus + r.renewBonus;
    } else if (role === "ADMIN") {
      totalSalary = commissionAmount + r.showPay + kocCommission + kolCommission;
    } else {
      totalSalary = r.baseSalary + r.seniorityBonus + commissionAmount + r.showPay + r.goalBonus + kocCommission + kolCommission;
    }

    const remainingPayment = totalSalary - r.advancePaid;

    const rWithKOC = r as typeof r & { kocCommission?: number; kolCommission?: number };
    const changed =
      Math.abs(r.totalRevenue    - totalRevenue)     > 0.01 ||
      Math.abs(r.commissionRate  - commissionRate)   > 0.001 ||
      Math.abs(r.commissionAmount - commissionAmount) > 0.01 ||
      Math.abs(r.totalSalary     - totalSalary)      > 0.01 ||
      Math.abs((rWithKOC.kocCommission ?? 0) - kocCommission) > 0.01 ||
      Math.abs((rWithKOC.kolCommission ?? 0) - kolCommission) > 0.01;

    if (!changed) return { ...r, kocCommission: rWithKOC.kocCommission ?? 0, kolCommission: rWithKOC.kolCommission ?? 0 };

    return prisma.salaryRecord.update({
      where: { id: r.id },
      data:  { totalRevenue, commissionRate, commissionAmount, totalSalary, remainingPayment,
               kocCommission: kocCommission as unknown as never,
               kolCommission: kolCommission as unknown as never },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
  }));

  return NextResponse.json(updated);
}

// ── POST — generate salary records ────────────────────────────────────────

type GenEntry = {
  userId:               string;
  userRole:             "PT" | "FM" | "ADMIN";
  showsL1L2Loyal:       number;
  showsL3L4L5:          number;
  clientsAchievedGoal:  number;
  googleReviews:        number;
  renewContracts:       number;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    branchId: string;
    month:    number;
    year:     number;
    entries:  GenEntry[];
  };

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
  if (!managedBranchIds.includes(body.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Total branch revenue in VND (actualRevenue stored in triệu → × 1,000,000)
  const branchAgg = await prisma.salesLead.aggregate({
    where: {
      branchId: body.branchId,
      month:    body.month,
      year:     body.year,
      status:   { in: ["PIF", "DE", "PB"] },
    },
    _sum: { actualRevenue: true },
  });
  const totalBranchRevenue = Number(branchAgg._sum.actualRevenue ?? 0) * 1_000_000;

  let created = 0;
  let skipped = 0;

  for (const entry of body.entries) {
    const existing = await prisma.salaryRecord.findFirst({
      where: { userId: entry.userId, month: body.month, year: body.year },
    });
    if (existing) { skipped++; continue; }

    const config = await prisma.salaryConfig.findFirst({
      where: { userId: entry.userId },
      orderBy: { effectiveFrom: "desc" },
    });

    let recordData;

    if (entry.userRole === "ADMIN") {
      const adminAgg = await prisma.salesLead.aggregate({
        where: {
          assignedPTId: entry.userId,
          month: body.month, year: body.year,
          status: { in: ["PIF", "DE", "PB"] },
        },
        _sum: { actualRevenue: true },
      });
      // actualRevenue stored in triệu → × 1,000,000 for VND
      const totalRevenue     = Number(adminAgg._sum.actualRevenue ?? 0) * 1_000_000;
      const rate             = ptRate(totalRevenue);
      const commissionAmount = totalRevenue * rate;
      const showPay          = entry.showsL1L2Loyal * 60_000 + entry.showsL3L4L5 * 100_000;
      const { kocCommission, kolCommission } = await fetchKOCKOLCommission(entry.userId);
      const totalSalary      = commissionAmount + showPay + kocCommission + kolCommission;

      recordData = {
        userId: entry.userId, branchId: body.branchId, month: body.month, year: body.year,
        baseSalary: 0, totalRevenue,
        commissionRate: rate * 100, commissionAmount,
        seniorityBonus: 0, fixedAllowances: 0,
        showsL1L2Loyal: entry.showsL1L2Loyal, showsL3L4L5: entry.showsL3L4L5, showPay,
        goalBonus: 0, clientsAchievedGoal: 0,
        googleBonus: 0, googleReviews: 0,
        renewBonus: 0, renewContracts: 0,
        bhxh: 0,
        kocCommission: kocCommission as unknown as never,
        kolCommission: kolCommission as unknown as never,
        totalSalary, advancePaid: 0, remainingPayment: totalSalary,
        status: "PENDING" as const,
      };
    } else if (entry.userRole === "FM") {
      const baseSalary         = config?.baseSalary         ?? 5_500_000;
      const lunchAllowance     = config?.lunchAllowance     ?? 2_600_000;
      const phoneAllowance     = config?.phoneAllowance     ?? 900_000;
      const transportAllowance = config?.transportAllowance ?? 500_000;
      const seniorityYears     = config?.seniorityYears     ?? 0;

      const fixedAllowances  = lunchAllowance + phoneAllowance + transportAllowance;
      const seniorityBonus   = Math.min(seniorityYears, 4) * 9_000_000;
      const rate             = fmRate(totalBranchRevenue);
      const commissionAmount = totalBranchRevenue * rate;

      const totalShows = Math.min(entry.showsL1L2Loyal + entry.showsL3L4L5, 60);
      const l3Shows    = Math.min(entry.showsL3L4L5, totalShows);
      const l1Shows    = Math.min(entry.showsL1L2Loyal, totalShows - l3Shows);
      const showPay    = l1Shows * 60_000 + l3Shows * 100_000;

      const googleBonus = entry.googleReviews * 100_000;
      const renewBonus  = entry.renewContracts * 150_000;
      const totalSalary = baseSalary + fixedAllowances + seniorityBonus +
                          commissionAmount + showPay + googleBonus + renewBonus;

      recordData = {
        userId: entry.userId, branchId: body.branchId, month: body.month, year: body.year,
        baseSalary, totalRevenue: totalBranchRevenue,
        commissionRate: rate * 100, commissionAmount,
        seniorityBonus, fixedAllowances,
        showsL1L2Loyal: l1Shows, showsL3L4L5: l3Shows, showPay,
        goalBonus: 0, clientsAchievedGoal: 0,
        googleBonus, googleReviews: entry.googleReviews,
        renewBonus, renewContracts: entry.renewContracts,
        bhxh: baseSalary,
        kocCommission: 0 as unknown as never,
        kolCommission: 0 as unknown as never,
        totalSalary, advancePaid: 0, remainingPayment: totalSalary,
        status: "PENDING" as const,
      };
    } else {
      // PT
      const ptAgg = await prisma.salesLead.aggregate({
        where: {
          assignedPTId: entry.userId,
          month: body.month, year: body.year,
          status: { in: ["PIF", "DE", "PB"] },
        },
        _sum: { actualRevenue: true },
      });
      // actualRevenue stored in triệu → × 1,000,000 for VND
      const totalRevenue   = Number(ptAgg._sum.actualRevenue ?? 0) * 1_000_000;
      const baseSalary     = config?.baseSalary     ?? 5_310_000;
      const seniorityYears = config?.seniorityYears ?? 0;

      const seniorityBonus   = Math.min(seniorityYears, 4) * 6_000_000;
      const rate             = ptRate(totalRevenue);
      const commissionAmount = totalRevenue * rate;
      const showPay          = entry.showsL1L2Loyal * 60_000 + entry.showsL3L4L5 * 100_000;
      const goalBonus        = entry.clientsAchievedGoal * 100_000;
      const { kocCommission, kolCommission } = await fetchKOCKOLCommission(entry.userId);
      const totalSalary      = baseSalary + seniorityBonus + commissionAmount + showPay + goalBonus + kocCommission + kolCommission;

      recordData = {
        userId: entry.userId, branchId: body.branchId, month: body.month, year: body.year,
        baseSalary, totalRevenue,
        commissionRate: rate * 100, commissionAmount,
        seniorityBonus, fixedAllowances: 0,
        showsL1L2Loyal: entry.showsL1L2Loyal, showsL3L4L5: entry.showsL3L4L5, showPay,
        goalBonus, clientsAchievedGoal: entry.clientsAchievedGoal,
        googleBonus: 0, googleReviews: 0,
        renewBonus: 0, renewContracts: 0,
        bhxh: 4_960_000,
        kocCommission: kocCommission as unknown as never,
        kolCommission: kolCommission as unknown as never,
        totalSalary, advancePaid: 0, remainingPayment: totalSalary,
        status: "PENDING" as const,
      };
    }

    await prisma.salaryRecord.create({ data: recordData });
    created++;
  }

  return NextResponse.json({ created, skipped });
}
