import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { standardWorkDays } from "@/lib/work-days";
import {
  LEAVE_DEDUCTION,
  MAX_CONSECUTIVE_ANNUAL,
  annualRunLengthWith,
  canManageLeaveOf,
  getAnnualLeaveBalance,
  getLeaveDaysOfMonth,
  isSunday,
  utcDay,
  type LeaveDayEntry,
} from "@/lib/leave-days";

/** Các ngày thực sự tính (Chủ nhật vốn không tính công nên bỏ ra ngoài). */
function countedDays(days: LeaveDayEntry[], month: number, year: number): LeaveDayEntry[] {
  return days.filter(d => !isSunday(utcDay(year, month, d.day)));
}

/** Trạng thái lịch nghỉ của một nhân sự trong tháng, dùng chung cho GET và POST. */
async function monthState(userId: string, month: number, year: number) {
  const [days, balance] = await Promise.all([
    getLeaveDaysOfMonth(userId, month, year),
    getAnnualLeaveBalance(userId, year),
  ]);
  const standard = standardWorkDays(month, year);
  const counted  = countedDays(days, month, year);
  // Số ngày công bị trừ — nghỉ thường 1, nghỉ nửa ngày 0,5, phép năm 0.
  const deducted = counted.reduce((sum, d) => sum + LEAVE_DEDUCTION[d.type], 0);

  return {
    userId, month, year, days,
    unpaidCount:      counted.filter(d => d.type === "UNPAID").length,
    halfDayCount:     counted.filter(d => d.type === "HALF_DAY").length,
    deductedDays:     deducted,
    annualQuota:      balance.quota,
    annualUsed:       balance.used,
    annualRemaining:  balance.remaining,
    standardWorkDays: standard,
    actualWorkDays:   Math.max(0, standard - deducted),
  };
}

function validPeriod(month: number, year: number) {
  return month >= 1 && month <= 12 && year >= 2020 && year <= 2100;
}

// ── GET — lịch nghỉ của một nhân sự trong tháng ────────────────────────────

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? session.user.id;
  const month  = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year   = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));

  if (!validPeriod(month, year)) {
    return NextResponse.json({ error: "Tháng/năm không hợp lệ" }, { status: 400 });
  }

  const allowed = await canManageLeaveOf(session.user, userId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(await monthState(userId, month, year));
}

// ── POST — đặt loại nghỉ cho một ngày, hoặc bỏ nghỉ ────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    userId?: string; day: number; month: number; year: number;
    /**
     * "ANNUAL" = phép năm, "UNPAID" = nghỉ thường, "HALF_DAY" = nghỉ nửa ngày,
     * "NONE" = bỏ nghỉ ngày đó.
     */
    type: "ANNUAL" | "UNPAID" | "HALF_DAY" | "NONE";
    note?: string;
  };
  const userId = body.userId ?? session.user.id;
  const { day, month, year, type } = body;

  if (!validPeriod(month, year)) {
    return NextResponse.json({ error: "Tháng/năm không hợp lệ" }, { status: 400 });
  }
  if (type !== "ANNUAL" && type !== "UNPAID" && type !== "HALF_DAY" && type !== "NONE") {
    return NextResponse.json({ error: "Loại nghỉ không hợp lệ" }, { status: 400 });
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (!(day >= 1 && day <= daysInMonth)) {
    return NextResponse.json({ error: "Ngày không hợp lệ" }, { status: 400 });
  }

  const allowed = await canManageLeaveOf(session.user, userId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const date = utcDay(year, month, day);
  // Chủ nhật đã bị trừ khỏi ngày công chuẩn nên tích nghỉ sẽ trừ lương hai lần.
  if (isSunday(date)) {
    return NextResponse.json({ error: "Chủ nhật vốn không tính ngày công" }, { status: 400 });
  }

  const existing = await prisma.leaveDay.findUnique({
    where:  { userId_date: { userId, date } },
    select: { id: true, type: true },
  });

  if (type === "NONE") {
    if (existing) await prisma.leaveDay.delete({ where: { id: existing.id } });
  } else if (type === "ANNUAL") {
    // Hai giới hạn của phép năm, kiểm tra trước khi ghi.
    if (existing?.type !== "ANNUAL") {
      const balance = await getAnnualLeaveBalance(userId, year);
      if (balance.remaining <= 0) {
        return NextResponse.json({
          error: `Đã dùng hết ${balance.quota} ngày phép của năm ${year}`,
        }, { status: 400 });
      }
    }
    const runLength = await annualRunLengthWith(userId, date);
    if (runLength > MAX_CONSECUTIVE_ANNUAL) {
      return NextResponse.json({
        error: `Nghỉ phép liên tiếp tối đa ${MAX_CONSECUTIVE_ANNUAL} ngày`,
      }, { status: 400 });
    }
    await prisma.leaveDay.upsert({
      where:  { userId_date: { userId, date } },
      update: { type: "ANNUAL", ...(body.note !== undefined && { note: body.note }) },
      create: { userId, date, type: "ANNUAL", note: body.note ?? null, createdById: session.user.id },
    });
  } else {
    // Nghỉ thường (trừ 1 công) và nghỉ nửa ngày (trừ 0,5 công) — không có hạn mức.
    await prisma.leaveDay.upsert({
      where:  { userId_date: { userId, date } },
      update: { type, ...(body.note !== undefined && { note: body.note }) },
      create: { userId, date, type, note: body.note ?? null, createdById: session.user.id },
    });
  }

  return NextResponse.json(await monthState(userId, month, year));
}
