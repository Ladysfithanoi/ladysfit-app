import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBranchRevenue, getUserRevenue } from "@/lib/salary-revenue";
import {
  SESSION_PAY_L1_L2_LOYAL,
  SESSION_PAY_L3_L4_L5,
  SESSION_PAY_RESIDENT,
  SESSION_PAY_TRIAL,
} from "@/lib/packages";
import { getTaughtSessions, getSessionAdjustments } from "@/lib/pt-session-count";
import { standardWorkDays } from "@/lib/work-days";
import { sumLeaveDeductionByUser } from "@/lib/leave-days";
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

async function fetchKOCKOLCommission(
  ptId:  string,
  month: number,
  year:  number,
): Promise<{ kocCommission: number; kolCommission: number; kocContracts: number; kolSessions: number }> {
  // KOC: thưởng một lần cho hợp đồng KẾT THÚC TRONG THÁNG NÀY.
  //
  // Cách cũ lọc theo pe.status = 'ACTIVE' và không giới hạn tháng nên trả lặp
  // lại mỗi tháng chừng nào gói còn ACTIVE. Gói KOC là 60 buổi/60 ngày nên khi
  // lộ trình tự đóng (hết buổi/hết hạn) điều kiện đó vĩnh viễn không khớp và
  // thưởng KOC sẽ không bao giờ được trả. Nay bám theo ngày kết thúc hợp đồng —
  // độc lập với trạng thái gói, và chỉ vào lương đúng một tháng.
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
    WHERE k."ptId" = $1 AND k.status = 'COMPLETED'
      AND k."endDate" >= $2 AND k."endDate" < $3
    `,
    ptId, new Date(year, month - 1, 1), new Date(year, month, 1)
  );

  let kocCommission = 0;
  let kocContracts = 0;
  for (const row of kocRows) {
    if (row.contractType === "KOC" && row.endWeightConfirmed) {
      kocCommission += calculateKOCCommission(Number(row.startWeight), row.endWeight != null ? Number(row.endWeight) : null, Number(row.totalSessions));
      kocContracts++;
    }
  }

  // KOL: 60.000đ cho mỗi buổi KOL DẠY TRONG THÁNG NÀY.
  //
  // Cách cũ cộng dồn pe."sessionsUsed" của mọi gói KOL ACTIVE (tổng số buổi từ
  // đầu hợp đồng) và trả lặp lại nguyên số đó mỗi tháng — một khách KOL 60 buổi
  // trả 3,6tr/tháng vô thời hạn, kể cả tháng PT không dạy buổi KOL nào. Nay đếm
  // đúng buổi đã check-out có chữ ký trong tháng, cùng nguồn với tiền buổi dạy,
  // nên buổi KOL dạy hộ cũng ghi công đúng người dạy.
  const taught = await getTaughtSessions([ptId], new Date(year, month - 1, 1), new Date(year, month, 1));
  const kolAdjust = (await getSessionAdjustments([ptId], month, year))
    .filter(a => a.contractType === "KOL")
    .reduce((sum, a) => sum + a.delta, 0);
  const kolSessions   = Math.max(0, taught.filter(r => r.contractType === "KOL").length + kolAdjust);
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
    include: { user: { select: { id: true, name: true, email: true, role: true, jobPosition: { select: { name: true, color: true } } } } },
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

  // Ngày công bị trừ theo lịch nghỉ của tháng (nghỉ thường 1, nửa ngày 0,5).
  // Nghỉ phép năm không nằm ở đây vì vẫn hưởng đủ lương.
  const leaveMap = await sumLeaveDeductionByUser(
    Array.from(new Set(records.map(r => r.userId))), month, year,
  );

  // Recalculate and patch each record where revenue-derived values changed
  const updated = await Promise.all(records.map(async (r) => {
    const role = r.user.role;

    const totalRevenue = role === "FM"
      ? (branchRevenueMap[r.branchId] ?? 0)
      : (ptRevenueMap[`${r.userId}:${r.branchId}`] ?? 0);

    // FM bị bỏ tích "hưởng hoa hồng doanh số phòng" thì tính lại vẫn phải giữ 0 —
    // nếu không, mỗi lần mở bảng lương là hoa hồng tự mọc lại khi doanh số phòng đổi.
    const rate = role === "FM"
      ? (r.branchCommission === false ? 0 : fmRate(totalRevenue))
      : ptRate(totalRevenue);
    const commissionRate   = rate * 100;
    const commissionAmount = totalRevenue * rate;

    // Fetch KOC/KOL commission for PT/ADMIN roles
    const { kocCommission, kolCommission } = (role !== "FM")
      ? await fetchKOCKOLCommission(r.userId, month, year)
      : { kocCommission: 0, kolCommission: 0 };

    // Bản ghi tạo trước khi có ngày công: điền ngày công chuẩn của tháng và coi
    // như đi làm đủ, để FM sửa được ngay mà tổng lương không đổi.
    const rWithDays = r as typeof r & { standardWorkDays?: number; actualWorkDays?: number; leaveDays?: number };
    const hasWorkDays      = (rWithDays.standardWorkDays ?? 0) > 0;
    const standardDays     = hasWorkDays ? rWithDays.standardWorkDays! : standardWorkDays(month, year);

    // Lịch nghỉ đổi bao nhiêu ngày thì trừ (hoặc trả lại) đúng bấy nhiêu ngày công,
    // nên phần FM sửa tay trước đó vẫn được giữ nguyên.
    const leaveCount  = leaveMap[r.userId] ?? 0;
    const storedLeave = rWithDays.leaveDays ?? 0;
    const baseDays    = hasWorkDays ? (rWithDays.actualWorkDays ?? 0) : standardDays;
    const actualDays  = leaveCount === storedLeave
      ? baseDays
      : Math.max(0, Math.min(baseDays - (leaveCount - storedLeave), standardDays));

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
      leaveCount !== storedLeave ||
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
        leaveDays:        leaveCount   as unknown as never,
        totalSalary,
        remainingPayment,
      },
      include: { user: { select: { id: true, name: true, email: true, role: true, jobPosition: { select: { name: true, color: true } } } } },
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
  showsL0:              number;
  /** FM: có hưởng hoa hồng doanh số cả phòng không (mặc định có). */
  branchCommission?:    boolean;
  clientsAchievedGoal:  number;
  googleReviews:        number;
  renewContracts:       number;
  /** Ngày công thực tế FM nhập; bỏ trống = đi làm đủ ngày công chuẩn. */
  actualWorkDays?:      number;
};

/**
 * Tiền buổi dạy: 100k gói L3/L4/L5, 60k gói L1/L2/Loyalfit, 50k gói trải nghiệm
 * L0, 35k gói tài trợ Cư dân.
 */
function calcShowPay(l1: number, l3: number, resident: number, l0: number) {
  return l1 * SESSION_PAY_L1_L2_LOYAL
       + l3 * SESSION_PAY_L3_L4_L5
       + resident * SESSION_PAY_RESIDENT
       + l0 * SESSION_PAY_TRIAL;
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
  // Ngày công bị trừ theo lịch nghỉ (nghỉ thường 1, nửa ngày 0,5) — mặc định trừ
  // luôn vào ngày công thực tế; nghỉ phép năm không trừ.
  const leaveMap = await sumLeaveDeductionByUser(targetUserIds, body.month, body.year);

  for (const entry of body.entries) {

    const config = await prisma.salaryConfig.findFirst({
      where: { userId: entry.userId },
      orderBy: { effectiveFrom: "desc" },
    });

    // Không nhập → lấy ngày công chuẩn trừ ngày nghỉ trên lịch; nhập vượt ngày
    // công chuẩn → chốt ở mức chuẩn.
    const leaveCount = leaveMap[entry.userId] ?? 0;
    const actDays = Math.max(0, Math.min(entry.actualWorkDays ?? (stdDays - leaveCount), stdDays));

    if (entry.userRole === "ADMIN") {
      const totalRevenue     = await getUserRevenue(entry.userId, body.branchId, body.month, body.year);
      const rate             = ptRate(totalRevenue);
      const commissionAmount = totalRevenue * rate;
      const showPay          = calcShowPay(entry.showsL1L2Loyal, entry.showsL3L4L5, entry.showsResident, entry.showsL0);
      const { kocCommission, kolCommission } = await fetchKOCKOLCommission(entry.userId, body.month, body.year);
      // Admin dạy thêm không có lương cứng nên ngày công không ảnh hưởng lương.
      const totalSalary      = commissionAmount + showPay + kocCommission + kolCommission;

      await prisma.salaryRecord.create({
        data: {
          userId: entry.userId, branchId: body.branchId, month: body.month, year: body.year,
          baseSalary: 0, totalRevenue, commissionRate: rate * 100, commissionAmount,
          seniorityBonus: 0, fixedAllowances: 0,
          standardWorkDays: stdDays as unknown as never, actualWorkDays: actDays as unknown as never,
          leaveDays: leaveCount as unknown as never,
          showsL1L2Loyal: entry.showsL1L2Loyal, showsL3L4L5: entry.showsL3L4L5,
          showsResident: entry.showsResident, showsL0: entry.showsL0, showPay,
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
      // Hoa hồng FM tính trên doanh số CẢ PHÒNG, nên cơ sở có nhiều FM mà ai cũng
      // hưởng thì phòng trả hoa hồng nhiều lần. Người tạo bảng lương quyết định ai
      // được hưởng; bỏ trống = hưởng (giữ đúng hành vi cũ cho cơ sở một FM).
      const takesBranchCommission = entry.branchCommission !== false;
      const rate             = takesBranchCommission ? fmRate(totalBranchRevenue) : 0;
      const commissionAmount = totalBranchRevenue * rate;

      // Trần 60 show/tháng: ưu tiên giữ lại buổi có đơn giá cao nhất (100k → 60k → 50k → 35k)
      const totalShows    = Math.min(
        entry.showsL1L2Loyal + entry.showsL3L4L5 + entry.showsResident + entry.showsL0,
        60
      );
      const l3Shows       = Math.min(entry.showsL3L4L5, totalShows);
      const l1Shows       = Math.min(entry.showsL1L2Loyal, totalShows - l3Shows);
      const l0Shows       = Math.min(entry.showsL0, totalShows - l3Shows - l1Shows);
      const residentShows = Math.min(entry.showsResident, totalShows - l3Shows - l1Shows - l0Shows);
      const showPay       = calcShowPay(l1Shows, l3Shows, residentShows, l0Shows);

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
          leaveDays: leaveCount as unknown as never,
          showsL1L2Loyal: l1Shows, showsL3L4L5: l3Shows, showsResident: residentShows,
          showsL0: l0Shows, showPay,
          branchCommission: takesBranchCommission,
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
      const showPay          = calcShowPay(entry.showsL1L2Loyal, entry.showsL3L4L5, entry.showsResident, entry.showsL0);
      const goalBonus        = entry.clientsAchievedGoal * 100_000;
      const { kocCommission, kolCommission } = await fetchKOCKOLCommission(entry.userId, body.month, body.year);
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
          leaveDays: leaveCount as unknown as never,
          showsL1L2Loyal: entry.showsL1L2Loyal, showsL3L4L5: entry.showsL3L4L5,
          showsResident: entry.showsResident, showsL0: entry.showsL0, showPay,
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
