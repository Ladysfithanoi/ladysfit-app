import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sumLeaveDeductionByUser } from "@/lib/leave-days";
import { computeTotalSalary } from "@/lib/salary-total";
import { showPayOf } from "@/lib/session-pay";
import { liveShowsForUser } from "@/lib/session-pay-server";

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
  // nghỉ xong, hay vừa dạy xong một buổi, sẽ không thấy gì đổi. Đồng bộ ngay ở
  // đây hai thứ PT tự sinh ra được:
  //
  //   • NGÀY NGHỈ — trừ đúng phần lịch nghỉ chênh so với lần tính trước, giữ
  //     nguyên số FM sửa tay.
  //   • TIỀN BUỔI DẠY — buổi đã check-in/check-out đầy đủ là đã đủ điều kiện
  //     tính tiền, nên đọc thẳng từ buổi tập (lib/session-pay), cùng nguồn với
  //     màn tạo bảng lương của FM nên hai bên luôn thấy một con số.
  if (record && record.standardWorkDays > 0) {
    const leaveCount = (await sumLeaveDeductionByUser([session.user.id], month, year))[session.user.id] ?? 0;
    const shows   = await liveShowsForUser(session.user.id, month, year);
    const showPay = showPayOf(shows);

    if (leaveCount !== record.leaveDays || Math.abs(showPay - record.showPay) > 0.01) {
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
        showPay,
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
          ...shows,
          showPay,
          totalSalary,
          remainingPayment: totalSalary - record.advancePaid,
        },
      });
      return NextResponse.json({ record: synced, config });
    }
  }

  return NextResponse.json({ record, config });
}
