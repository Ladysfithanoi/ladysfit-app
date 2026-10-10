import { NextResponse } from "next/server";
import { applyLeaveChange, isSalaryLocked, liveInsuranceDeduction, liveSeniorityBonus, recalcSalary, salaryUpdateData } from "@/lib/salary-live";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SalaryStatus } from "@prisma/client";
import { standardWorkDays } from "@/lib/work-days";
import { sumWorkDayDeductionByUser } from "@/lib/leave-days";
import { bhxhBaseOf, computeTotalSalary, hourlyBaseOf, remainingPaymentOf } from "@/lib/salary-total";
import { GOOGLE_BONUS_AMOUNT, normalizeReviewCount } from "@/lib/google-review-bonus";

const RECORD_INCLUDE = {
  user: { select: { id: true, name: true, email: true, role: true, jobPosition: { select: { name: true, color: true, hourlyPay: true } } } },
} as const;

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const record = await prisma.salaryRecord.findUnique({
    where:   { id: params.id },
    include: { user: { select: { id: true, name: true, role: true, jobPosition: { select: { hourlyPay: true } } } } },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
  if (!managedBranchIds.includes(record.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    status?: SalaryStatus; advancePaid?: number; notes?: string; actualWorkDays?: number;
    /**
     * Số ngày nghỉ (leaveDays) của bản ghi lúc màn hình hiện `actualWorkDays` —
     * để lịch nghỉ đổi sau lúc tải trang thì chỉ áp phần chênh (applyLeaveChange).
     */
    leaveDaysSeen?: number;
    /** Lương cơ bản FM đặt tay cho người này ngay trong bảng lương. */
    baseSalary?: number;
    /** FM: số lượt đánh giá Google Business — thưởng theo số này. */
    googleReviews?: number;
    /** Lao công tính theo giờ: Số tiền/giờ và Số giờ làm của tháng. */
    hourlyRate?: number;
    workHours?:  number;
  };

  // ── BẢNG LƯƠNG ĐÃ CHỐT (isSalaryLocked) ──────────────────────────────────
  // Xác nhận = lương đã tính xong: không sửa tay, không tính lại nữa. Chỉ còn
  // được chuyển giữa "Đã xác nhận" ↔ "Đã thanh toán".
  const editKeys = Object.keys(body).filter((k) => k !== "status");
  if (isSalaryLocked(record.status)) {
    if (editKeys.length > 0 || !body.status || !isSalaryLocked(body.status)) {
      return NextResponse.json(
        { error: "Bảng lương đã xác nhận — không chỉnh sửa được nữa" },
        { status: 409 },
      );
    }
    const updated = await prisma.salaryRecord.update({
      where: { id: params.id }, data: { status: body.status }, include: RECORD_INCLUDE,
    });
    await syncPaidExpense(record, record.status, body.status, record.totalSalary, session.user.id);
    return NextResponse.json(updated);
  }
  if (body.status && isSalaryLocked(body.status)) {
    if (editKeys.length > 0) {
      return NextResponse.json({ error: "Lưu phần đang sửa trước rồi mới Xác nhận" }, { status: 400 });
    }
    // Chốt bằng số MỚI NHẤT — cùng công thức tính lại của màn Quỹ lương — rồi
    // từ đây con số đứng yên.
    const { patch } = await recalcSalary({
      record, role: record.user.role, month: record.month, year: record.year,
    });
    const updated = await prisma.salaryRecord.update({
      where: { id: params.id },
      data:  { ...salaryUpdateData(patch), status: body.status },
      include: RECORD_INCLUDE,
    });
    await syncPaidExpense(record, record.status, body.status, patch.totalSalary, session.user.id);
    return NextResponse.json(updated);
  }

  for (const v of [body.hourlyRate, body.workHours]) {
    if (v !== undefined && !(Number.isFinite(v) && v >= 0)) {
      return NextResponse.json({ error: "Số tiền/giờ hoặc số giờ làm không hợp lệ" }, { status: 400 });
    }
  }
  // TÍNH THEO GIỜ (Lao công — JobPosition.hourlyPay): lương = tiền/giờ × số giờ.
  // Dòng tạo trước khi chức vụ chuyển sang tính theo giờ cũng chuyển luôn khi FM
  // nhập tiền/giờ hoặc số giờ ở đây.
  const positionHourly = record.user.role === "STAFF" && !!record.user.jobPosition?.hourlyPay;
  const hourlyPay  = record.hourlyPay ||
    (positionHourly && (body.hourlyRate !== undefined || body.workHours !== undefined));
  const hourlyRate = hourlyPay ? (body.hourlyRate ?? record.hourlyRate) : record.hourlyRate;
  const workHours  = hourlyPay ? (body.workHours  ?? record.workHours)  : record.workHours;

  if (body.baseSalary !== undefined && !(Number.isFinite(body.baseSalary) && body.baseSalary >= 0)) {
    return NextResponse.json({ error: "Lương cơ bản không hợp lệ" }, { status: 400 });
  }
  // Admin dạy thêm không có lương cứng nên không có lương cơ bản để sửa.
  const baseSalary = hourlyPay
    ? hourlyBaseOf(hourlyRate, workHours)
    : body.baseSalary !== undefined && record.user.role !== "ADMIN"
    ? body.baseSalary
    : record.baseSalary;

  // Thưởng Google chỉ có ở FM: sửa số lượt là thưởng đổi theo.
  const editsGoogle   = body.googleReviews !== undefined && record.user.role === "FM";
  const googleReviews = editsGoogle ? normalizeReviewCount(body.googleReviews) : record.googleReviews;
  const googleBonus   = editsGoogle ? googleReviews * GOOGLE_BONUS_AMOUNT : record.googleBonus;

  const oldStatus    = record.status;
  const newStatus    = body.status ?? oldStatus;
  const advancePaid  = body.advancePaid !== undefined ? body.advancePaid : record.advancePaid;

  // ── Ngày công thực tế → tính lại lương cứng theo tỉ lệ ─────────────────────
  const rec = record as typeof record & { standardWorkDays?: number; actualWorkDays?: number };
  const standardDays = (rec.standardWorkDays ?? 0) > 0
    ? rec.standardWorkDays!
    : standardWorkDays(record.month, record.year);

  // Ngày nghỉ trên lịch nghỉ tại thời điểm sửa; ghi lại cùng ngày công để lần
  // tính sau chỉ trừ phần chênh lệch.
  //
  // Số FM nhập đã trừ đúng số ngày nghỉ màn hình lúc đó đang thấy (leaveDaysSeen),
  // không phải số của lịch NGAY BÂY GIỜ. Trước đây ghép thẳng hai số đó: tích nghỉ
  // / bỏ nghỉ trong lúc màn lương chưa tải lại rồi bấm Lưu (kể cả chỉ để sửa tạm
  // ứng) là ngày nghỉ bị trừ hai lần — nghỉ 1 ngày mà mất 2 công — hoặc mất hẳn.
  const leaveCount = (await sumWorkDayDeductionByUser([record.userId], record.month, record.year))[record.userId] ?? 0;
  const hasWorkDays = (rec.standardWorkDays ?? 0) > 0;
  const actualDays = body.actualWorkDays !== undefined
    ? applyLeaveChange(
        Math.max(0, Math.min(body.actualWorkDays, standardDays)),
        body.leaveDaysSeen ?? leaveCount,
        leaveCount,
        standardDays,
      )
    : applyLeaveChange(
        hasWorkDays ? (rec.actualWorkDays ?? 0) : standardDays,
        hasWorkDays ? record.leaveDays : 0,
        leaveCount,
        standardDays,
      );

  // Thâm niên theo đúng tháng lương — cùng một hàm với lúc tính lại (salary-live).
  const seniorityBonus = await liveSeniorityBonus(record.userId, record.user.role, record.month, record.year);

  const totalSalary = computeTotalSalary({
    role:             record.user.role,
    baseSalary,
    fixedAllowances:  record.fixedAllowances,
    seniorityBonus,
    commissionAmount: record.commissionAmount,
    showPay:          record.showPay,
    goalBonus:        record.goalBonus,
    googleBonus,
    renewBonus:       record.renewBonus,
    kocCommission:    record.kocCommission,
    kolCommission:    record.kolCommission,
    standardWorkDays: standardDays,
    actualWorkDays:   actualDays,
    hourlyPay,
  });
  // Mức đóng BHXH đi theo lương cơ bản — sửa lương cơ bản thì mức đóng (và tiền
  // bảo hiểm trừ vào lương) đổi theo.
  const bhxh = bhxhBaseOf(record.user.role, baseSalary);
  const insuranceDeduction = await liveInsuranceDeduction(record.userId, bhxh, record.month, record.year);
  const remainingPayment = remainingPaymentOf(totalSalary, insuranceDeduction, advancePaid);

  const updated = await prisma.salaryRecord.update({
    where: { id: params.id },
    data: {
      ...(body.status && { status: body.status }),
      advancePaid,
      baseSalary,
      hourlyPay,
      hourlyRate,
      workHours,
      seniorityBonus,
      googleReviews,
      googleBonus,
      bhxh,
      insuranceDeduction,
      standardWorkDays: standardDays as unknown as never,
      actualWorkDays:   actualDays   as unknown as never,
      leaveDays:        leaveCount   as unknown as never,
      totalSalary,
      remainingPayment,
      ...(body.notes !== undefined && { notes: body.notes }),
    },
    include: RECORD_INCLUDE,
  });

  // Lương cơ bản sửa trong bảng lương cũng ghi vào cấu hình lương của người đó,
  // để tháng sau tạo bảng lương không phải nhập lại (và tab Cấu hình lương khớp).
  // Tính theo giờ thì chỉ Số tiền/giờ là cấu hình (số giờ đổi theo tháng).
  if (hourlyPay && hourlyRate !== record.hourlyRate) {
    const config = await prisma.salaryConfig.findFirst({
      where:   { userId: record.userId, branchId: record.branchId },
      orderBy: { effectiveFrom: "desc" },
    });
    if (config) {
      await prisma.salaryConfig.update({ where: { id: config.id }, data: { hourlyRate } });
    } else {
      await prisma.salaryConfig.create({
        data: { userId: record.userId, branchId: record.branchId, hourlyRate, effectiveFrom: new Date() },
      });
    }
  }
  if (!hourlyPay && baseSalary !== record.baseSalary) {
    const config = await prisma.salaryConfig.findFirst({
      where:   { userId: record.userId, branchId: record.branchId },
      orderBy: { effectiveFrom: "desc" },
    });
    if (config) {
      await prisma.salaryConfig.update({ where: { id: config.id }, data: { baseSalary } });
    } else {
      await prisma.salaryConfig.create({
        data: { userId: record.userId, branchId: record.branchId, baseSalary, effectiveFrom: new Date() },
      });
    }
  }

  await syncPaidExpense(record, oldStatus, newStatus, totalSalary, session.user.id);

  return NextResponse.json(updated);
}

/**
 * Khoản chi "Quỹ lương" đi theo trạng thái Đã thanh toán: chuyển sang PAID thì
 * ghi một khoản chi (nếu chưa có), rời PAID thì xoá đi.
 */
async function syncPaidExpense(
  record: { id: string; branchId: string; month: number; year: number; user: { name: string | null } },
  oldStatus: string,
  newStatus: string,
  totalSalary: number,
  createdById: string,
) {
  if (newStatus === "PAID" && oldStatus !== "PAID") {
    const existing = await prisma.transaction.findFirst({ where: { referenceId: record.id } });
    if (!existing) {
      // record.month is 1-based (April = 4); JS Date months are 0-based,
      // so passing record.month as-is maps April(4) → index 4 = May → 5th of next month ✓
      const paymentDate = new Date(record.year, record.month, 5);
      await prisma.transaction.create({
        data: {
          branchId:        record.branchId,
          type:            "EXPENSE",
          category:        "Quỹ lương",
          amount:          totalSalary,
          description:     `Lương tháng ${record.month}/${record.year} - ${record.user.name ?? ""}`,
          transactionDate: paymentDate,
          referenceId:     record.id,
          createdById,
        },
      });
    }
  }
  if (oldStatus === "PAID" && newStatus !== "PAID") {
    await prisma.transaction.deleteMany({ where: { referenceId: record.id } });
  }
}
