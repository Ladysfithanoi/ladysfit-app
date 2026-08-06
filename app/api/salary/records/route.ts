import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBranchRevenue, getUserRevenue } from "@/lib/salary-revenue";
import {
  SESSION_PAY_L1_L2_LOYAL,
  SESSION_PAY_L3_L4_L5,
  SESSION_PAY_RESIDENT,
} from "@/lib/packages";
import { standardWorkDays } from "@/lib/work-days";
import { computeTotalSalary } from "@/lib/salary-total";

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
    startWeight: number;
    endWeight: number | null;
    endWeightConfirmed: boolean;
    totalSessions: number;
    contractType: string;
  }[]>(
    `
    SELECT k."startWeight", k."endWeight", k."endWeightConfirmed", k."totalSessions",
           pe."contractType"
    FROM koc_contracts k
    JOIN package_enrollments pe ON pe.id = k."enrollmentId"
    WHERE k."ptId" = $1 AND k.status = 'COMPLETED' AND pe.status = 'ACTIVE'
    `,
    ptId
  );

  let kocCommission = 0;
  let kocContracts = 0;
  for (const row of kocRows) {
    if (row.contractType === "KOC" && row.endWeightConfirmed) {
      kocCommission += calculateKOCCommission(Number(row.startWeight), row.endWeight != null ? Number(row.endWeight) : null, Number(row.totalSessions));
      kocContracts++;
    }
  }

  // KOL: sum sessions_used for active KOL packages assigned to this PT
  const kolRows = await prisma.$queryRawUnsafe<{ total_sessions: number }[]>(
    `
    SELECT COALESCE(SUM(pe."sessionsUsed"), 0)::int AS total_sessions
    FROM package_enrollments pe
    JOIN clients c ON c.id = pe."clientId"
    WHERE c."assignedPTId" = $1 AND pe."contractType" = 'KOL' AND pe.status = 'ACTIVE'
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
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userRole = session.user.role;
  if (userRole !== "FM" && userRole !== "COO") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const month    = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year     = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));

  let branchFilter: string[];
  if (userRole === "COO") {
    if (branchId) {
      branchFilter = [branchId];
    } else {
      const allBranches = await prisma.branch.findMany({
        where: { name: { not: { contains: "Fitpartner" } } },
        select: { id: true },
      });
      branchFilter = allBranches.map(b => b.id);
    }
  } else {
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    if (branchId && !managedBranchIds.includes(branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    branchFilter = branchId ? [branchId] : managedBranchIds;
  }
  console.log("[salary/GET] branchFilter:", branchFilter, "month:", month, "year:", year);

  const records = await prisma.salaryRecord.findMany({
    where: { branchId: { in: branchFilter }, month, year, user: { deletedAt: null } },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: [{ user: { role: "asc" } }, { user: { name: "asc" } }],
  });

  console.log("[salary/GET] records found:", records.length);
  if (records.length === 0) return NextResponse.json(records);

  // Fresh branch revenue (VND) per branchId — used for FM commission
  const uniqueBranchIds = Array.from(new Set(records.map(r => r.branchId)));
  const branchRevenueMap: Record<string, number> = {};
  await Promise.all(uniqueBranchIds.map(async (bid) => {
    branchRevenueMap[bid] = await getBranchRevenue(bid, month, year);
  }));

  // Fresh individual revenue (VND) per user — used for PT/ADMIN commission.
  // Khoá theo cả cơ sở: một người có thể có bảng lương ở nhiều cơ sở.
  const ptAdminRecords = records.filter(r => r.user.role !== "FM");
  const ptRevenueMap: Record<string, number> = {};
  await Promise.all(ptAdminRecords.map(async (r) => {
    ptRevenueMap[`${r.userId}:${r.branchId}`] = await getUserRevenue(r.userId, r.branchId, month, year);
  }));

  // Recalculate and patch each record where revenue-derived values changed
  const updated = await Promise.all(records.map(async (r) => {
    const role = r.user.role;

    const totalRevenue = role === "FM"
      ? (branchRevenueMap[r.branchId] ?? 0)
      : (ptRevenueMap[`${r.userId}:${r.branchId}`] ?? 0);

    const rate           = role === "FM" ? fmRate(totalRevenue) : ptRate(totalRevenue);
    const commissionRate   = rate * 100;
    const commissionAmount = totalRevenue * rate;

    // Fetch KOC/KOL commission for PT/ADMIN roles
    const { kocCommission, kolCommission } = (role !== "FM")
      ? await fetchKOCKOLCommission(r.userId)
      : { kocCommission: 0, kolCommission: 0 };

    // Bản ghi tạo trước khi có ngày công: điền ngày công chuẩn của tháng và coi
    // như đi làm đủ, để FM sửa được ngay mà tổng lương không đổi.
    const rWithDays = r as typeof r & { standardWorkDays?: number; actualWorkDays?: number };
    const hasWorkDays      = (rWithDays.standardWorkDays ?? 0) > 0;
    const standardDays     = hasWorkDays ? rWithDays.standardWorkDays! : standardWorkDays(month, year);
    const actualDays       = hasWorkDays ? (rWithDays.actualWorkDays ?? 0) : standardDays;

    const totalSalary = computeTotalSalary({
      role,
      baseSalary:       r.baseSalary,
      fixedAllowances:  r.fixedAllowances,
      seniorityBonus:   r.seniorityBonus,
      commissionAmount,
      showPay:          r.showPay,
      goalBonus:        r.goalBonus,
      googleBonus:      r.googleBonus,
      renewBonus:       r.renewBonus,
      kocCommission,
      kolCommission,
      standardWorkDays: standardDays,
      actualWorkDays:   actualDays,
    });

    const remainingPayment = totalSalary - r.advancePaid;

    const rWithKOC = r as typeof r & { kocCommission?: number; kolCommission?: number };
    const changed =
      !hasWorkDays ||
      Math.abs(r.totalRevenue    - totalRevenue)     > 0.01 ||
      Math.abs(r.commissionRate  - commissionRate)   > 0.001 ||
      Math.abs(r.commissionAmount - commissionAmount) > 0.01 ||
      Math.abs(r.totalSalary     - totalSalary)      > 0.01 ||
      Math.abs((rWithKOC.kocCommission ?? 0) - kocCommission) > 0.01 ||
      Math.abs((rWithKOC.kolCommission ?? 0) - kolCommission) > 0.01;

    if (!changed) return { ...r, kocCommission: rWithKOC.kocCommission ?? 0, kolCommission: rWithKOC.kolCommission ?? 0 };

    const refreshed = await prisma.salaryRecord.update({
      where: { id: r.id },
      data: {
        totalRevenue,
        commissionRate,
        commissionAmount,
        kocCommission: kocCommission as unknown as never,
        kolCommission: kolCommission as unknown as never,
        standardWorkDays: standardDays as unknown as never,
        actualWorkDays:   actualDays   as unknown as never,
        totalSalary,
        remainingPayment,
      },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    return { ...refreshed, kocCommission, kolCommission };
  }));

  console.log("[salary/GET] returning", updated.length, "records");
  return NextResponse.json(updated);
  } catch (error: unknown) {
    const e = error as { message?: string; stack?: string; code?: string };
    console.error("=== Salary GET error ===", e.message);
    console.error("Stack:", e.stack);
    return NextResponse.json({ error: e.message, code: e.code }, { status: 500 });
  }
}

// ── POST — generate salary records ────────────────────────────────────────

type GenEntry = {
  userId:               string;
  userRole:             "PT" | "FM" | "ADMIN";
  showsL1L2Loyal:       number;
  showsL3L4L5:          number;
  showsResident:        number;
  clientsAchievedGoal:  number;
  googleReviews:        number;
  renewContracts:       number;
  /** Ngày công thực tế FM nhập; bỏ trống = đi làm đủ ngày công chuẩn. */
  actualWorkDays?:      number;
};

/** Tiền buổi dạy: 60k gói L1/L2/Loyalfit, 100k gói L3/L4/L5, 35k gói tài trợ Cư dân. */
function calcShowPay(l1: number, l3: number, resident: number) {
  return l1 * SESSION_PAY_L1_L2_LOYAL
       + l3 * SESSION_PAY_L3_L4_L5
       + resident * SESSION_PAY_RESIDENT;
}

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

  // Doanh số cả phòng (VND) — cùng định nghĩa với "Tổng doanh thu" bên Setup
  const totalBranchRevenue = await getBranchRevenue(body.branchId, body.month, body.year);

  // Delete any existing records for this branch/month/year so regeneration
  // always produces fresh data instead of silently skipping.
  const targetUserIds = body.entries.map((e) => e.userId);
  await prisma.salaryRecord.deleteMany({
    where: {
      branchId: body.branchId,
      month:    body.month,
      year:     body.year,
      userId:   { in: targetUserIds },
    },
  });

  let created = 0;
  const skipped = 0;

  // Ngày công chuẩn của tháng = số ngày trong tháng − số Chủ nhật (26–27 ngày).
  const stdDays = standardWorkDays(body.month, body.year);

  for (const entry of body.entries) {

    const config = await prisma.salaryConfig.findFirst({
      where: { userId: entry.userId },
      orderBy: { effectiveFrom: "desc" },
    });

    // Không nhập → mặc định đi làm đủ; nhập vượt ngày công chuẩn → chốt ở mức chuẩn.
    const actDays = Math.max(0, Math.min(entry.actualWorkDays ?? stdDays, stdDays));

    if (entry.userRole === "ADMIN") {
      const totalRevenue     = await getUserRevenue(entry.userId, body.branchId, body.month, body.year);
      const rate             = ptRate(totalRevenue);
      const commissionAmount = totalRevenue * rate;
      const showPay          = calcShowPay(entry.showsL1L2Loyal, entry.showsL3L4L5, entry.showsResident);
      const { kocCommission, kolCommission } = await fetchKOCKOLCommission(entry.userId);
      // Admin dạy thêm không có lương cứng nên ngày công không ảnh hưởng lương.
      const totalSalary      = commissionAmount + showPay + kocCommission + kolCommission;

      await prisma.salaryRecord.create({
        data: {
          userId: entry.userId, branchId: body.branchId, month: body.month, year: body.year,
          baseSalary: 0, totalRevenue, commissionRate: rate * 100, commissionAmount,
          seniorityBonus: 0, fixedAllowances: 0,
          standardWorkDays: stdDays as unknown as never, actualWorkDays: actDays as unknown as never,
          showsL1L2Loyal: entry.showsL1L2Loyal, showsL3L4L5: entry.showsL3L4L5,
          showsResident: entry.showsResident, showPay,
          goalBonus: 0, clientsAchievedGoal: 0,
          googleBonus: 0, googleReviews: 0, renewBonus: 0, renewContracts: 0,
          bhxh: 0, kocCommission: kocCommission as unknown as never, kolCommission: kolCommission as unknown as never,
          totalSalary, advancePaid: 0, remainingPayment: totalSalary,
        },
      });
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

      // Trần 60 show/tháng: ưu tiên giữ lại buổi có đơn giá cao nhất (100k → 60k → 35k)
      const totalShows    = Math.min(entry.showsL1L2Loyal + entry.showsL3L4L5 + entry.showsResident, 60);
      const l3Shows       = Math.min(entry.showsL3L4L5, totalShows);
      const l1Shows       = Math.min(entry.showsL1L2Loyal, totalShows - l3Shows);
      const residentShows = Math.min(entry.showsResident, totalShows - l3Shows - l1Shows);
      const showPay       = calcShowPay(l1Shows, l3Shows, residentShows);

      const googleBonus = entry.googleReviews * 100_000;
      const renewBonus  = entry.renewContracts * 150_000;
      const totalSalary = computeTotalSalary({
        role: "FM", baseSalary, fixedAllowances, seniorityBonus, commissionAmount,
        showPay, goalBonus: 0, googleBonus, renewBonus, kocCommission: 0, kolCommission: 0,
        standardWorkDays: stdDays, actualWorkDays: actDays,
      });

      await prisma.salaryRecord.create({
        data: {
          userId: entry.userId, branchId: body.branchId, month: body.month, year: body.year,
          baseSalary, totalRevenue: totalBranchRevenue, commissionRate: rate * 100, commissionAmount,
          seniorityBonus, fixedAllowances,
          standardWorkDays: stdDays as unknown as never, actualWorkDays: actDays as unknown as never,
          showsL1L2Loyal: l1Shows, showsL3L4L5: l3Shows, showsResident: residentShows, showPay,
          goalBonus: 0, clientsAchievedGoal: 0,
          googleBonus, googleReviews: entry.googleReviews,
          renewBonus, renewContracts: entry.renewContracts,
          bhxh: baseSalary, kocCommission: 0 as unknown as never, kolCommission: 0 as unknown as never,
          totalSalary, advancePaid: 0, remainingPayment: totalSalary,
        },
      });
    } else {
      // PT
      const totalRevenue   = await getUserRevenue(entry.userId, body.branchId, body.month, body.year);
      const baseSalary     = config?.baseSalary     ?? 5_310_000;
      const seniorityYears = config?.seniorityYears ?? 0;

      const seniorityBonus   = Math.min(seniorityYears, 4) * 6_000_000;
      const rate             = ptRate(totalRevenue);
      const commissionAmount = totalRevenue * rate;
      const showPay          = calcShowPay(entry.showsL1L2Loyal, entry.showsL3L4L5, entry.showsResident);
      const goalBonus        = entry.clientsAchievedGoal * 100_000;
      const { kocCommission, kolCommission } = await fetchKOCKOLCommission(entry.userId);
      const totalSalary      = computeTotalSalary({
        role: "PT", baseSalary, fixedAllowances: 0, seniorityBonus, commissionAmount,
        showPay, goalBonus, googleBonus: 0, renewBonus: 0, kocCommission, kolCommission,
        standardWorkDays: stdDays, actualWorkDays: actDays,
      });

      await prisma.salaryRecord.create({
        data: {
          userId: entry.userId, branchId: body.branchId, month: body.month, year: body.year,
          baseSalary, totalRevenue, commissionRate: rate * 100, commissionAmount,
          seniorityBonus, fixedAllowances: 0,
          standardWorkDays: stdDays as unknown as never, actualWorkDays: actDays as unknown as never,
          showsL1L2Loyal: entry.showsL1L2Loyal, showsL3L4L5: entry.showsL3L4L5,
          showsResident: entry.showsResident, showPay,
          goalBonus, clientsAchievedGoal: entry.clientsAchievedGoal,
          googleBonus: 0, googleReviews: 0, renewBonus: 0, renewContracts: 0,
          bhxh: 4_960_000, kocCommission: kocCommission as unknown as never, kolCommission: kolCommission as unknown as never,
          totalSalary, advancePaid: 0, remainingPayment: totalSalary,
        },
      });
    }

    created++;
  }

  return NextResponse.json({ created, skipped });
}
