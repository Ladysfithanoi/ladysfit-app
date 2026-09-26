import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBranchRevenue, getUserRevenue } from "@/lib/salary-revenue";
import { showPayOf } from "@/lib/session-pay";
import { standardWorkDays } from "@/lib/work-days";
import { sumWorkDayDeductionByUser } from "@/lib/leave-days";
import { computeTotalSalary } from "@/lib/salary-total";
// Công thức tính lại lương theo thời gian thực nằm chung một chỗ với bảng lương
// PT tự xem (/api/salary/my) — xem lib/salary-live.ts.
import { ptRate, fmRate, fetchKOCKOLCommission, recalcSalary, salaryUpdateData } from "@/lib/salary-live";
import { computeTransformBonuses, TRANSFORM_BONUS_AMOUNT } from "@/lib/transform-bonus";

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
  const ptAdminRecords = records.filter(r => r.user.role !== "FM" && r.user.role !== "STAFF");
  const ptRevenueMap: Record<string, number> = {};
  await Promise.all(ptAdminRecords.map(async (r) => {
    ptRevenueMap[`${r.userId}:${r.branchId}`] = await getUserRevenue(r.userId, r.branchId, month, year);
  }));

  // Ngày công bị trừ theo lịch nghỉ của tháng (nghỉ thường 1, nửa ngày 0,5).
  // Nghỉ phép năm không nằm ở đây vì vẫn hưởng đủ lương.
  const leaveMap = await sumWorkDayDeductionByUser(
    Array.from(new Set(records.map(r => r.userId))), month, year,
  );

  // Thưởng transform của cả tháng — tính một lần, mỗi dòng lọc phần của mình.
  const transformBonuses = await computeTransformBonuses({
    start: new Date(year, month - 1, 1),
    end:   new Date(year, month, 1),
  });

  // Recalculate and patch each record where revenue-derived values changed
  const updated = await Promise.all(records.map(async (r) => {
    const role = r.user.role;

    const { patch, changed } = await recalcSalary({
      record:     r,
      role,
      month,
      year,
      revenue:    role === "FM"
        ? (branchRevenueMap[r.branchId] ?? 0)
        : (ptRevenueMap[`${r.userId}:${r.branchId}`] ?? 0),
      leaveCount: leaveMap[r.userId] ?? 0,
      transformBonuses,
    });

    if (!changed) return r;

    return prisma.salaryRecord.update({
      where: { id: r.id },
      data: salaryUpdateData(patch),
      include: { user: { select: { id: true, name: true, email: true, role: true, jobPosition: { select: { name: true, color: true } } } } },
    });
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
  /** STAFF = lao công, marketing… — chỉ có lương cứng theo ngày công. */
  userRole:             "PT" | "FM" | "ADMIN" | "STAFF";
  showsL1L2Loyal:       number;
  showsL3L4L5:          number;
  showsResident:        number;
  showsL0:              number;
  /** Buổi dạy khách chuyển giao — 50.000đ/buổi. */
  showsTransfer?:       number;
  /** FM: có hưởng hoa hồng doanh số cả phòng không (mặc định có). */
  branchCommission?:    boolean;
  /** Bỏ qua — thưởng transform nay tự tính (lib/transform-bonus). */
  clientsAchievedGoal?: number;
  googleReviews:        number;
  renewContracts:       number;
  /** Ngày công thực tế FM nhập; bỏ trống = đi làm đủ ngày công chuẩn. */
  actualWorkDays?:      number;
};



export async function POST(req: Request) {
  try {
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

  // Mỗi người CHỈ có một bảng lương mỗi tháng — xem @@unique([userId, month, year])
  // ở model SalaryRecord. Dòng nào của cơ sở này thì vừa bị xoá ở trên; cái còn
  // sót lại là bảng lương tháng này của họ ở CƠ SỞ KHÁC.
  //
  // Hay gặp nhất: FM quản nhiều cơ sở. FM không có branchId nên màn tạo bảng
  // lương luôn tự thêm chính người đang bấm vào danh sách; tạo cho cơ sở thứ hai
  // là đụng đúng dòng của mình đã tạo ở cơ sở thứ nhất. Trước đây create ném
  // P2002 và cả lượt tạo hỏng — FM chỉ thấy HTTP 500, không ai được tạo dòng nào.
  // Nay bỏ qua đúng người đó và báo rõ, những người còn lại vẫn được tạo.
  const clashes = await prisma.salaryRecord.findMany({
    where: { userId: { in: targetUserIds }, month: body.month, year: body.year },
    select: { userId: true, user: { select: { name: true, email: true } }, branch: { select: { name: true } } },
  });
  const blocked = new Map(
    clashes.map((c) => [c.userId, { name: c.user.name ?? c.user.email, branchName: c.branch.name }]),
  );

  let created = 0;
  let skipped = 0;

  // Ngày công chuẩn của tháng = số ngày trong tháng − số Chủ nhật (26–27 ngày).
  const stdDays = standardWorkDays(body.month, body.year);
  const transformBonuses = await computeTransformBonuses({
    start: new Date(body.year, body.month - 1, 1),
    end:   new Date(body.year, body.month, 1),
  });
  // Ngày công bị trừ theo lịch nghỉ (nghỉ thường 1, nửa ngày 0,5) — mặc định trừ
  // luôn vào ngày công thực tế; nghỉ phép năm không trừ.
  const leaveMap = await sumWorkDayDeductionByUser(targetUserIds, body.month, body.year);

  for (const entry of body.entries) {
    if (blocked.has(entry.userId)) {
      skipped++;
      continue;
    }

    const config = await prisma.salaryConfig.findFirst({
      where: { userId: entry.userId },
      orderBy: { effectiveFrom: "desc" },
    });

    // Không nhập → lấy ngày công chuẩn trừ ngày nghỉ trên lịch; nhập vượt ngày
    // công chuẩn → chốt ở mức chuẩn.
    const leaveCount = leaveMap[entry.userId] ?? 0;
    const actDays = Math.max(0, Math.min(entry.actualWorkDays ?? (stdDays - leaveCount), stdDays));

    if (entry.userRole === "STAFF") {
      // Nhân sự STAFF (lao công, marketing…): lương cơ bản theo cấu hình lương,
      // chia theo ngày công. Không doanh số, không hoa hồng, không buổi dạy.
      // Chưa cấu hình thì để 0 — mức 5.310.000đ chỉ là mặc định của PT. FM đặt
      // lương cơ bản cho từng người ngay trong bảng lương hoặc tab Cấu hình lương.
      const baseSalary  = config?.baseSalary ?? 0;
      const totalSalary = computeTotalSalary({
        role: "STAFF", baseSalary, fixedAllowances: 0, seniorityBonus: 0, commissionAmount: 0,
        showPay: 0, goalBonus: 0, googleBonus: 0, renewBonus: 0, kocCommission: 0, kolCommission: 0,
        standardWorkDays: stdDays, actualWorkDays: actDays,
      });

      await prisma.salaryRecord.create({
        data: {
          userId: entry.userId, branchId: body.branchId, month: body.month, year: body.year,
          baseSalary, totalRevenue: 0, commissionRate: 0, commissionAmount: 0,
          seniorityBonus: 0, fixedAllowances: 0,
          standardWorkDays: stdDays as unknown as never, actualWorkDays: actDays as unknown as never,
          leaveDays: leaveCount as unknown as never,
          showsL1L2Loyal: 0, showsL3L4L5: 0, showsResident: 0, showsL0: 0,
          showsTransfer: 0 as unknown as never, showPay: 0,
          goalBonus: 0, clientsAchievedGoal: 0,
          googleBonus: 0, googleReviews: 0, renewBonus: 0, renewContracts: 0,
          bhxh: 0, kocCommission: 0 as unknown as never, kolCommission: 0 as unknown as never,
          totalSalary, advancePaid: 0, remainingPayment: totalSalary,
        },
      });
    } else if (entry.userRole === "ADMIN") {
      const totalRevenue     = await getUserRevenue(entry.userId, body.branchId, body.month, body.year);
      const rate             = ptRate(totalRevenue);
      const commissionAmount = totalRevenue * rate;
      const showPay          = showPayOf(entry);
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
          showsResident: entry.showsResident, showsL0: entry.showsL0,
          showsTransfer: (entry.showsTransfer ?? 0) as unknown as never, showPay,
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

      // Trần 60 show/tháng: ưu tiên giữ lại buổi có đơn giá cao nhất
      // (100k L3+ → 60k L1/L2/L0 → 50k chuyển giao → 35k Cư dân)
      const entryTransfer = entry.showsTransfer ?? 0;
      const totalShows    = Math.min(
        entry.showsL1L2Loyal + entry.showsL3L4L5 + entry.showsResident + entry.showsL0 + entryTransfer,
        60
      );
      const l3Shows       = Math.min(entry.showsL3L4L5, totalShows);
      const l1Shows       = Math.min(entry.showsL1L2Loyal, totalShows - l3Shows);
      const l0Shows       = Math.min(entry.showsL0, totalShows - l3Shows - l1Shows);
      const transferShows = Math.min(entryTransfer, totalShows - l3Shows - l1Shows - l0Shows);
      const residentShows = Math.min(entry.showsResident, totalShows - l3Shows - l1Shows - l0Shows - transferShows);
      const showPay       = showPayOf({
        showsL1L2Loyal: l1Shows, showsL3L4L5: l3Shows,
        showsResident: residentShows, showsL0: l0Shows, showsTransfer: transferShows,
      });

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
          showsL0: l0Shows, showsTransfer: transferShows as unknown as never, showPay,
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
      const showPay          = showPayOf(entry);
      // Thưởng transform tự tính theo hợp đồng đạt cam kết — xem lib/transform-bonus.
      const clientsAchievedGoal = transformBonuses.filter(b => b.ptId === entry.userId).length;
      const goalBonus        = clientsAchievedGoal * TRANSFORM_BONUS_AMOUNT;
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
          showsResident: entry.showsResident, showsL0: entry.showsL0,
          showsTransfer: (entry.showsTransfer ?? 0) as unknown as never, showPay,
          goalBonus, clientsAchievedGoal,
          googleBonus: 0, googleReviews: 0, renewBonus: 0, renewContracts: 0,
          bhxh: 4_960_000, kocCommission: kocCommission as unknown as never, kolCommission: kolCommission as unknown as never,
          totalSalary, advancePaid: 0, remainingPayment: totalSalary,
        },
      });
    }

    created++;
  }

  return NextResponse.json({
    created,
    skipped,
    skippedDetails: Array.from(blocked.values()),
  });
  } catch (error: unknown) {
    const e = error as { message?: string; stack?: string; code?: string };
    console.error("=== Salary POST error ===", e.code, e.message);
    console.error("Stack:", e.stack);
    return NextResponse.json(
      { error: e.message ?? "Không tạo được bảng lương", code: e.code },
      { status: 500 },
    );
  }
}
