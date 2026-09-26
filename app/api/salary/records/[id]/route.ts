import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SalaryStatus } from "@prisma/client";
import { standardWorkDays } from "@/lib/work-days";
import { sumWorkDayDeductionByUser } from "@/lib/leave-days";
import { computeTotalSalary } from "@/lib/salary-total";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const record = await prisma.salaryRecord.findUnique({
    where:   { id: params.id },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
  if (!managedBranchIds.includes(record.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    status?: SalaryStatus; advancePaid?: number; notes?: string; actualWorkDays?: number;
    /** Lương cơ bản FM đặt tay cho người này ngay trong bảng lương. */
    baseSalary?: number;
  };

  if (body.baseSalary !== undefined && !(Number.isFinite(body.baseSalary) && body.baseSalary >= 0)) {
    return NextResponse.json({ error: "Lương cơ bản không hợp lệ" }, { status: 400 });
  }
  // Admin dạy thêm không có lương cứng nên không có lương cơ bản để sửa.
  const baseSalary = body.baseSalary !== undefined && record.user.role !== "ADMIN"
    ? body.baseSalary
    : record.baseSalary;

  const oldStatus    = record.status;
  const newStatus    = body.status ?? oldStatus;
  const advancePaid  = body.advancePaid !== undefined ? body.advancePaid : record.advancePaid;

  // ── Ngày công thực tế → tính lại lương cứng theo tỉ lệ ─────────────────────
  const rec = record as typeof record & { standardWorkDays?: number; actualWorkDays?: number };
  const standardDays = (rec.standardWorkDays ?? 0) > 0
    ? rec.standardWorkDays!
    : standardWorkDays(record.month, record.year);

  // Ngày nghỉ trên lịch nghỉ tại thời điểm sửa. FM nhập tay thì lấy đúng số FM
  // nhập; ghi lại số ngày nghỉ đã áp để lần tính sau chỉ trừ phần chênh lệch.
  const leaveCount = (await sumWorkDayDeductionByUser([record.userId], record.month, record.year))[record.userId] ?? 0;
  const actualDays = body.actualWorkDays !== undefined
    ? Math.max(0, Math.min(body.actualWorkDays, standardDays))
    : ((rec.standardWorkDays ?? 0) > 0
        ? (rec.actualWorkDays ?? 0)
        : Math.max(0, standardDays - leaveCount));

  const totalSalary = computeTotalSalary({
    role:             record.user.role,
    baseSalary,
    fixedAllowances:  record.fixedAllowances,
    seniorityBonus:   record.seniorityBonus,
    commissionAmount: record.commissionAmount,
    showPay:          record.showPay,
    goalBonus:        record.goalBonus,
    googleBonus:      record.googleBonus,
    renewBonus:       record.renewBonus,
    kocCommission:    record.kocCommission,
    kolCommission:    record.kolCommission,
    standardWorkDays: standardDays,
    actualWorkDays:   actualDays,
  });
  const remainingPayment = totalSalary - advancePaid;

  const updated = await prisma.salaryRecord.update({
    where: { id: params.id },
    data: {
      ...(body.status && { status: body.status }),
      advancePaid,
      baseSalary,
      standardWorkDays: standardDays as unknown as never,
      actualWorkDays:   actualDays   as unknown as never,
      leaveDays:        leaveCount   as unknown as never,
      totalSalary,
      remainingPayment,
      ...(body.notes !== undefined && { notes: body.notes }),
    },
    include: { user: { select: { id: true, name: true, email: true, role: true, jobPosition: { select: { name: true, color: true } } } } },
  });

  // Lương cơ bản sửa trong bảng lương cũng ghi vào cấu hình lương của người đó,
  // để tháng sau tạo bảng lương không phải nhập lại (và tab Cấu hình lương khớp).
  if (baseSalary !== record.baseSalary) {
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

  // ── Auto-create expense transaction when marking PAID ────────────────────
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
          createdById:     session.user.id,
        },
      });
    }
  }

  // ── Auto-delete expense transaction when reverting from PAID ─────────────
  if (oldStatus === "PAID" && newStatus !== "PAID") {
    await prisma.transaction.deleteMany({ where: { referenceId: record.id } });
  }

  return NextResponse.json(updated);
}
