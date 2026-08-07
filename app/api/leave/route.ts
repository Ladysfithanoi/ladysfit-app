import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { standardWorkDays } from "@/lib/work-days";
import {
  canManageLeaveOf,
  getLeaveDaysOfMonth,
  isSunday,
  utcDay,
} from "@/lib/leave-days";

/** Số ngày nghỉ tính công = tổng ngày đã tích trừ các Chủ nhật. */
function countableLeave(days: number[], month: number, year: number): number {
  return days.filter(d => !isSunday(utcDay(year, month, d))).length;
}

// ── GET — lịch nghỉ của một nhân sự trong tháng ────────────────────────────

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? session.user.id;
  const month  = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year   = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));

  if (!(month >= 1 && month <= 12) || !(year >= 2020 && year <= 2100)) {
    return NextResponse.json({ error: "Tháng/năm không hợp lệ" }, { status: 400 });
  }

  const allowed = await canManageLeaveOf(session.user, userId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const days     = await getLeaveDaysOfMonth(userId, month, year);
  const standard = standardWorkDays(month, year);
  const leave    = countableLeave(days, month, year);

  return NextResponse.json({
    userId, month, year, days,
    leaveCount:       leave,
    standardWorkDays: standard,
    actualWorkDays:   Math.max(0, standard - leave),
  });
}

// ── POST — tích / bỏ tích một ngày nghỉ ────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    userId?: string; day: number; month: number; year: number; note?: string;
  };
  const userId = body.userId ?? session.user.id;
  const { day, month, year } = body;

  if (!(month >= 1 && month <= 12) || !(year >= 2020 && year <= 2100)) {
    return NextResponse.json({ error: "Tháng/năm không hợp lệ" }, { status: 400 });
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
    where: { userId_date: { userId, date } },
    select: { id: true },
  });

  if (existing) {
    await prisma.leaveDay.delete({ where: { id: existing.id } });
  } else {
    await prisma.leaveDay.create({
      data: { userId, date, note: body.note ?? null, createdById: session.user.id },
    });
  }

  const days     = await getLeaveDaysOfMonth(userId, month, year);
  const standard = standardWorkDays(month, year);
  const leave    = countableLeave(days, month, year);

  return NextResponse.json({
    userId, month, year, days,
    checked:          !existing,
    leaveCount:       leave,
    standardWorkDays: standard,
    actualWorkDays:   Math.max(0, standard - leave),
  });
}
