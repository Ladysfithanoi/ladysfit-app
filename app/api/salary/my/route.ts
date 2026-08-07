import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countUnpaidLeaveByUser } from "@/lib/leave-days";
import { computeTotalSalary } from "@/lib/salary-total";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "PT";
  if (!isPT) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  const [record, config] = await Promise.all([
    prisma.salaryRecord.findFirst({ where: { userId: session.user.id, month, year } }),
    prisma.salaryConfig.findFirst({
      where: { userId: session.user.id },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);

  // Bảng lương chỉ được tính lại khi FM mở trang Quỹ lương, nên PT tự tích lịch
  // nghỉ xong sẽ không thấy gì đổi. Đồng bộ luôn phần ngày nghỉ ở đây: trừ đúng
  // phần lịch nghỉ chênh so với lần tính trước, giữ nguyên số FM sửa tay.
  if (record && record.standardWorkDays > 0) {
    const leaveCount = (await countUnpaidLeaveByUser([session.user.id], month, year))[session.user.id] ?? 0;
    if (leaveCount !== record.leaveDays) {
      const actualWorkDays = Math.max(0, Math.min(
        record.actualWorkDays - (leaveCount - record.leaveDays),
        record.standardWorkDays,
      ));
      const totalSalary = computeTotalSalary({
        role:             role,
        baseSalary:       record.baseSalary,
        fixedAllowances:  record.fixedAllowances,
        seniorityBonus:   record.seniorityBonus,
        commissionAmount: record.commissionAmount,
        showPay:          record.showPay,
        goalBonus:        record.goalBonus,
        googleBonus:      record.googleBonus,
        renewBonus:       record.renewBonus,
        kocCommission:    record.kocCommission,
        kolCommission:    record.kolCommission,
        standardWorkDays: record.standardWorkDays,
        actualWorkDays,
      });
      const synced = await prisma.salaryRecord.update({
        where: { id: record.id },
        data:  {
          actualWorkDays,
          leaveDays: leaveCount,
          totalSalary,
          remainingPayment: totalSalary - record.advancePaid,
        },
      });
      return NextResponse.json({ record: synced, config });
    }
  }

  return NextResponse.json({ record, config });
}
