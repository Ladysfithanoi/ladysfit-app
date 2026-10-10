import { NextResponse } from "next/server";
import { monthlySeniorityBonus, seniorityYearsFor } from "@/lib/seniority";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBranchRevenue, getUserRevenue } from "@/lib/salary-revenue";
import { showPayOf, capFmShows } from "@/lib/session-pay";
import { standardWorkDays } from "@/lib/work-days";
import { sumWorkDayDeductionByUser } from "@/lib/leave-days";
import { bhxhBaseOf, computeTotalSalary, hourlyBaseOf, insuranceDeductionOf, remainingPaymentOf } from "@/lib/salary-total";
// Công thức tính lại lương theo thời gian thực nằm chung một chỗ với bảng lương
// PT tự xem (/api/salary/my) — xem lib/salary-live.ts.
import { ptRate, fmRate, fetchKOCKOLCommission, isSalaryLocked, loadLiveSalaryRecords, payBranchScope } from "@/lib/salary-live";
import { computeTransformBonuses, TRANSFORM_BONUS_AMOUNT } from "@/lib/transform-bonus";
import { getBranchRenewCount, RENEW_BONUS_AMOUNT } from "@/lib/renew-bonus";
import { GOOGLE_BONUS_AMOUNT, normalizeReviewCount } from "@/lib/google-review-bonus";
import { vnMonthStart } from "@/lib/format-date";
import { latestSalaryConfig } from "@/lib/salary-config";

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

  // Cùng một đường với file Excel (POST /api/salary/export) — xem loadLiveSalaryRecords.
  const updated = await loadLiveSalaryRecords(branchFilter, month, year);

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
  /** FM: số lượt đánh giá Google Business nhập tay — thưởng theo số này. */
  googleReviews?:       number;
  /** Bỏ qua — thưởng Renew nay tự đếm từ Setup doanh số (lib/renew-bonus). */
  renewContracts?:      number;
  /** Ngày công thực tế FM nhập; bỏ trống = đi làm đủ ngày công chuẩn. */
  actualWorkDays?:      number;
  /** Lao công tính theo giờ: số giờ làm trong tháng (Số tiền/giờ lấy ở cấu hình lương). */
  workHours?:           number;
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

  // Admin / STAFF chỉ có bảng lương ở cơ sở họ đã chọn làm việc (lib/work-branches)
  // — màn tạo bảng lương đã lọc sẵn, chốt lại ở đây để không ai gửi tay tạo được
  // bảng lương ở cơ sở họ không làm.
  const adminIds = body.entries
    .filter((e) => e.userRole === "ADMIN" || e.userRole === "STAFF")
    .map((e) => e.userId);
  if (adminIds.length > 0) {
    const working = await prisma.user.findMany({
      where: {
        id: { in: adminIds },
        OR: [
          { branchId: body.branchId, managedBranches: { none: {} } },
          { managedBranches: { some: { branchId: body.branchId } } },
        ],
      },
      select: { id: true },
    });
    const allowed = new Set(working.map((u) => u.id));
    body.entries = body.entries.filter((e) =>
      (e.userRole !== "ADMIN" && e.userRole !== "STAFF") || allowed.has(e.userId));
  }

  // Dòng đã Xác nhận / đã trả là bảng lương chính thức của tháng (isSalaryLocked):
  // tạo lại KHÔNG xoá, không ghi đè — chỉ tạo cho người chưa chốt.
  const lockedRows = await prisma.salaryRecord.findMany({
    where: {
      branchId: body.branchId, month: body.month, year: body.year,
      userId: { in: body.entries.map((e) => e.userId) },
    },
    select: { userId: true, status: true },
  });
  const lockedIds = new Set(lockedRows.filter((r) => isSalaryLocked(r.status)).map((r) => r.userId));
  body.entries = body.entries.filter((e) => !lockedIds.has(e.userId));

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
  //
  // Riêng Admin và Lao công / Marketing làm nhiều cơ sở (lib/work-branches): có
  // một dòng ở MỖI cơ sở (Admin: buổi dạy khách cơ sở nào tính vào dòng cơ sở
  // đó — payBranchScope; STAFF: lương cơ bản cấu hình riêng từng cơ sở).
  const clashes = await prisma.salaryRecord.findMany({
    where: {
      userId: { in: targetUserIds }, month: body.month, year: body.year,
      NOT: { user: { OR: [
        { role: "ADMIN" },
        { role: "STAFF", managedBranches: { some: {} } },
      ] } },
    },
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
    start: vnMonthStart(body.year, body.month),
    end:   vnMonthStart(body.year, body.month + 1),
  });
  // Ngày công bị trừ theo lịch nghỉ (nghỉ thường 1, nửa ngày 0,5) — mặc định trừ
  // luôn vào ngày công thực tế; nghỉ phép năm không trừ.
  const leaveMap = await sumWorkDayDeductionByUser(targetUserIds, body.month, body.year);

  // Ai tính lương theo giờ — theo chức vụ hiện tại (lib/salary-total hourlyBaseOf).
  const hourlyUserIds = new Set((await prisma.user.findMany({
    where:  { id: { in: targetUserIds }, role: "STAFF", jobPosition: { hourlyPay: true } },
    select: { id: true },
  })).map((u) => u.id));

  for (const entry of body.entries) {
    if (blocked.has(entry.userId)) {
      skipped++;
      continue;
    }

    // STAFF làm nhiều cơ sở có lương cơ bản riêng ở từng cơ sở — đọc cấu hình
    // của CƠ SỞ NÀY trước (xem latestSalaryConfig).
    const config = entry.userRole === "STAFF"
      ? await latestSalaryConfig(entry.userId, body.branchId)
      : await prisma.salaryConfig.findFirst({
          where: { userId: entry.userId },
          orderBy: { effectiveFrom: "desc" },
        });

    // Mức đóng BHXH + phần người lao động đóng bảo hiểm (trừ vào "Còn lại nhận").
    const insuranceFields = (role: string, baseSalary: number, totalSalary: number) => {
      const bhxh = bhxhBaseOf(role, baseSalary);
      const insuranceDeduction = insuranceDeductionOf(bhxh, config?.insuranceStartDate, body.month, body.year);
      return { bhxh, insuranceDeduction, remainingPayment: remainingPaymentOf(totalSalary, insuranceDeduction, 0) };
    };

    // Không nhập → lấy ngày công chuẩn trừ ngày nghỉ trên lịch; nhập vượt ngày
    // công chuẩn → chốt ở mức chuẩn.
    const leaveCount = leaveMap[entry.userId] ?? 0;
    const actDays = Math.max(0, Math.min(entry.actualWorkDays ?? (stdDays - leaveCount), stdDays));

    if (entry.userRole === "STAFF") {
      // Nhân sự STAFF (lao công, marketing…): lương cơ bản theo cấu hình lương,
      // chia theo ngày công. Không doanh số, không hoa hồng, không buổi dạy.
      // Chưa cấu hình thì để 0 — mức 5.310.000đ chỉ là mặc định của PT. FM đặt
      // lương cơ bản cho từng người ngay trong bảng lương hoặc tab Cấu hình lương.
      //
      // Chức vụ tính THEO GIỜ (Lao công — JobPosition.hourlyPay): lương = Số
      // tiền/giờ (cấu hình lương của cơ sở này) × Số giờ làm FM nhập.
      const hourlyPay  = hourlyUserIds.has(entry.userId);
      const hourlyRate = hourlyPay ? (config?.hourlyRate ?? 0) : 0;
      const workHours  = hourlyPay ? Math.max(0, Number(entry.workHours) || 0) : 0;
      const baseSalary = hourlyPay ? hourlyBaseOf(hourlyRate, workHours) : (config?.baseSalary ?? 0);
      const totalSalary = computeTotalSalary({
        role: "STAFF", baseSalary, fixedAllowances: 0, seniorityBonus: 0, commissionAmount: 0,
        showPay: 0, goalBonus: 0, googleBonus: 0, renewBonus: 0, kocCommission: 0, kolCommission: 0,
        standardWorkDays: stdDays, actualWorkDays: actDays, hourlyPay,
      });

      await prisma.salaryRecord.create({
        data: {
          userId: entry.userId, branchId: body.branchId, month: body.month, year: body.year,
          baseSalary, hourlyPay, hourlyRate, workHours,
          totalRevenue: 0, commissionRate: 0, commissionAmount: 0,
          seniorityBonus: 0, fixedAllowances: 0,
          standardWorkDays: stdDays as unknown as never, actualWorkDays: actDays as unknown as never,
          leaveDays: leaveCount as unknown as never,
          showsL1L2Loyal: 0, showsL3L4L5: 0, showsResident: 0, showsL0: 0,
          showsTransfer: 0 as unknown as never, showPay: 0,
          goalBonus: 0, clientsAchievedGoal: 0,
          googleBonus: 0, googleReviews: 0, renewBonus: 0, renewContracts: 0,
          ...insuranceFields("STAFF", baseSalary, totalSalary),
          kocCommission: 0 as unknown as never, kolCommission: 0 as unknown as never,
          totalSalary, advancePaid: 0,
        },
      });
    } else if (entry.userRole === "ADMIN") {
      const totalRevenue     = await getUserRevenue(entry.userId, body.branchId, body.month, body.year);
      const rate             = ptRate(totalRevenue);
      const commissionAmount = totalRevenue * rate;
      const showPay          = showPayOf(entry);
      const { kocCommission, kolCommission } = await fetchKOCKOLCommission(
        entry.userId, body.month, body.year, payBranchScope("ADMIN", body.branchId),
      );
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
      const seniorityYears     = seniorityYearsFor(config, body.month, body.year);

      const fixedAllowances  = lunchAllowance + phoneAllowance + transportAllowance;
      const seniorityBonus   = monthlySeniorityBonus("FM", seniorityYears);
      // Hoa hồng FM tính trên doanh số CẢ PHÒNG, nên cơ sở có nhiều FM mà ai cũng
      // hưởng thì phòng trả hoa hồng nhiều lần. Người tạo bảng lương quyết định ai
      // được hưởng; bỏ trống = hưởng (giữ đúng hành vi cũ cho cơ sở một FM).
      const takesBranchCommission = entry.branchCommission !== false;
      const rate             = takesBranchCommission ? fmRate(totalBranchRevenue) : 0;
      const commissionAmount = totalBranchRevenue * rate;

      // Trần 60 show/tháng — luật viết một lần ở capFmShows (lib/session-pay).
      const capped        = capFmShows(entry);
      const l3Shows       = capped.showsL3L4L5;
      const l1Shows       = capped.showsL1L2Loyal;
      const l0Shows       = capped.showsL0;
      const transferShows = capped.showsTransfer;
      const residentShows = capped.showsResident;
      const showPay       = showPayOf(capped);

      // Thưởng Renew tự đếm từ Setup doanh số của cơ sở, đi cùng ô "hưởng hoa
      // hồng doanh số cả phòng": cơ sở nhiều FM thì chỉ người được tích nhận,
      // không thì một gói renew bị thưởng nhiều lần.
      const renewContracts = takesBranchCommission
        ? await getBranchRenewCount(body.branchId, body.month, body.year)
        : 0;
      // Thưởng Google: nhập số lượt đánh giá như nhập show, ảnh chỉ để đối chiếu.
      const googleReviews = normalizeReviewCount(entry.googleReviews);
      const googleBonus = googleReviews * GOOGLE_BONUS_AMOUNT;
      const renewBonus  = renewContracts * RENEW_BONUS_AMOUNT;
      // Buổi dạy khách KOL / hợp đồng KOC của chính FM — ngoài trần 60 show.
      const { kocCommission, kolCommission } = await fetchKOCKOLCommission(entry.userId, body.month, body.year);
      const totalSalary = computeTotalSalary({
        role: "FM", baseSalary, fixedAllowances, seniorityBonus, commissionAmount,
        showPay, goalBonus: 0, googleBonus, renewBonus, kocCommission, kolCommission,
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
          googleBonus, googleReviews,
          renewBonus, renewContracts,
          ...insuranceFields("FM", baseSalary, totalSalary),
          kocCommission: kocCommission as unknown as never, kolCommission: kolCommission as unknown as never,
          totalSalary, advancePaid: 0,
        },
      });
    } else {
      // PT
      const totalRevenue   = await getUserRevenue(entry.userId, body.branchId, body.month, body.year);
      const baseSalary     = config?.baseSalary     ?? 5_310_000;
      const seniorityYears = seniorityYearsFor(config, body.month, body.year);

      const seniorityBonus   = monthlySeniorityBonus("PT", seniorityYears);
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
          ...insuranceFields("PT", baseSalary, totalSalary),
          kocCommission: kocCommission as unknown as never, kolCommission: kolCommission as unknown as never,
          totalSalary, advancePaid: 0,
        },
      });
    }

    created++;
  }

  return NextResponse.json({
    created,
    skipped,
    locked: lockedIds.size,
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
