import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    let totalSalary: number;
    if (role === "FM") {
      totalSalary = r.baseSalary + r.fixedAllowances + r.seniorityBonus +
                    commissionAmount + r.showPay + r.googleBonus + r.renewBonus;
    } else if (role === "ADMIN") {
      totalSalary = commissionAmount + r.showPay;
    } else {
      totalSalary = r.baseSalary + r.seniorityBonus + commissionAmount + r.showPay + r.goalBonus;
    }

    const remainingPayment = totalSalary - r.advancePaid;

    const changed =
      Math.abs(r.totalRevenue    - totalRevenue)     > 0.01 ||
      Math.abs(r.commissionRate  - commissionRate)   > 0.001 ||
      Math.abs(r.commissionAmount - commissionAmount) > 0.01 ||
      Math.abs(r.totalSalary     - totalSalary)      > 0.01;

    if (!changed) return r;

    return prisma.salaryRecord.update({
      where: { id: r.id },
      data:  { totalRevenue, commissionRate, commissionAmount, totalSalary, remainingPayment },
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
      const totalSalary      = commissionAmount + showPay;

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
      const totalSalary      = baseSalary + seniorityBonus + commissionAmount + showPay + goalBonus;

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
        totalSalary, advancePaid: 0, remainingPayment: totalSalary,
        status: "PENDING" as const,
      };
    }

    await prisma.salaryRecord.create({ data: recordData });
    created++;
  }

  return NextResponse.json({ created, skipped });
}
