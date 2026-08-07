/**
 * Lịch nghỉ của nhân sự.
 *
 * Mỗi ngày nhân sự (hoặc FM/Admin) tích trên lịch là một dòng trong `leave_days`,
 * kèm loại nghỉ:
 *   • ANNUAL — nghỉ phép năm, VẪN HƯỞNG ĐỦ LƯƠNG nên không đụng tới ngày công.
 *   • UNPAID — nghỉ thường, bị trừ thẳng vào NGÀY CÔNG THỰC TẾ của bảng lương
 *     tháng đó (xem lib/work-days.ts cho cách ngày công chia lương cứng).
 *
 * Quy định phép năm: mỗi tháng làm việc được 1 ngày phép, tối đa 12 ngày/năm,
 * không dùng hết thì mất khi hết năm (không cộng dồn sang năm sau), và một đợt
 * nghỉ phép liên tiếp tối đa 5 ngày.
 *
 * Chủ nhật KHÔNG tích được: ngày công chuẩn đã trừ sẵn Chủ nhật nên tích thêm sẽ
 * trừ lương hai lần. Vì vậy khi đếm một đợt nghỉ liên tiếp, Chủ nhật xen giữa
 * không làm đứt đợt và cũng không được tính là một ngày phép.
 *
 * Cột `date` là DATE của Postgres nên mọi mốc thời gian ở đây đều dựng bằng UTC —
 * dùng giờ địa phương sẽ lệch một ngày khi máy chủ chạy ở múi giờ khác.
 */

import { prisma } from "@/lib/prisma";
import type { LeaveType } from "@prisma/client";

/** Số ngày phép tối đa của một năm làm việc đủ 12 tháng. */
export const ANNUAL_LEAVE_PER_YEAR = 12;

/** Số ngày phép tối đa của một đợt nghỉ liên tiếp. */
export const MAX_CONSECUTIVE_ANNUAL = 5;

/** Nửa đêm UTC của một ngày dương lịch. `month` 1-based, tự tràn sang năm sau. */
export function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Khoảng ngày của một tháng, dùng trực tiếp cho filter `date` của Prisma. */
export function monthDateRange(month: number, year: number) {
  return { gte: utcDay(year, month, 1), lt: utcDay(year, month + 1, 1) };
}

/** Khoảng ngày của cả một năm. */
export function yearDateRange(year: number) {
  return { gte: utcDay(year, 1, 1), lt: utcDay(year + 1, 1, 1) };
}

/** `true` nếu là Chủ nhật — ngày đó vốn không tính công nên không tính nghỉ. */
export function isSunday(date: Date): boolean {
  return date.getUTCDay() === 0;
}

/** Khoá `YYYY-MM-DD` của một mốc ngày, để so khớp ngày với ngày. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Một ngày đã tích trong tháng: ngày trong tháng và loại nghỉ. */
export type LeaveDayEntry = { day: number; type: LeaveType };

/** Các ngày đã tích nghỉ của một nhân sự trong tháng, kèm loại nghỉ. */
export async function getLeaveDaysOfMonth(
  userId: string,
  month:  number,
  year:   number,
): Promise<LeaveDayEntry[]> {
  const rows = await prisma.leaveDay.findMany({
    where:   { userId, date: monthDateRange(month, year) },
    orderBy: { date: "asc" },
    select:  { date: true, type: true },
  });
  return rows.map(r => ({ day: r.date.getUTCDate(), type: r.type }));
}

/**
 * Số ngày nghỉ KHÔNG LƯƠNG của từng nhân sự trong tháng (đã bỏ Chủ nhật) — đây
 * là số bị trừ vào ngày công. Nghỉ phép năm không tính vào đây.
 * Nhân sự không có ngày nghỉ nào vẫn có khoá trong kết quả với giá trị 0.
 */
export async function countUnpaidLeaveByUser(
  userIds: string[],
  month:   number,
  year:    number,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const id of userIds) counts[id] = 0;
  if (userIds.length === 0) return counts;

  const rows = await prisma.leaveDay.findMany({
    where:  { userId: { in: userIds }, date: monthDateRange(month, year), type: "UNPAID" },
    select: { userId: true, date: true },
  });
  for (const row of rows) {
    if (isSunday(row.date)) continue;
    counts[row.userId] = (counts[row.userId] ?? 0) + 1;
  }
  return counts;
}

// ── Phép năm ───────────────────────────────────────────────────────────────

/**
 * Ngày nhận việc: lấy từ cấu hình lương (ô "Ngày nhận việc (BHXH)"), chưa khai
 * thì lùi về ngày tạo tài khoản để nhân sự cũ vẫn có đủ phép.
 */
export async function getHireDate(userId: string): Promise<Date | null> {
  const [config, user] = await Promise.all([
    prisma.salaryConfig.findFirst({
      where:   { userId, startDate: { not: null } },
      orderBy: { effectiveFrom: "desc" },
      select:  { startDate: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);
  return config?.startDate ?? user?.createdAt ?? null;
}

/**
 * Số ngày phép được hưởng trong một năm: mỗi tháng làm việc 1 ngày, tối đa 12.
 * Vào làm giữa năm thì tính từ tháng nhận việc (tháng nhận việc tính trọn 1
 * ngày phép), làm từ trước năm đó thì đủ 12 ngày. Phép không cộng dồn sang năm
 * sau nên chỉ cần nhìn trong phạm vi một năm.
 */
export function annualLeaveQuota(hireDate: Date | null, year: number): number {
  if (!hireDate) return ANNUAL_LEAVE_PER_YEAR;

  const hireYear  = hireDate.getUTCFullYear();
  const hireMonth = hireDate.getUTCMonth() + 1;

  if (hireYear > year)  return 0;
  if (hireYear < year)  return ANNUAL_LEAVE_PER_YEAR;
  return Math.max(0, Math.min(ANNUAL_LEAVE_PER_YEAR, 13 - hireMonth));
}

/** Số ngày phép đã dùng trong năm (bỏ Chủ nhật, dù Chủ nhật cũng không tích được). */
export async function countAnnualLeaveInYear(userId: string, year: number): Promise<number> {
  const rows = await prisma.leaveDay.findMany({
    where:  { userId, date: yearDateRange(year), type: "ANNUAL" },
    select: { date: true },
  });
  return rows.filter(r => !isSunday(r.date)).length;
}

/** Quỹ phép của một nhân sự trong năm. */
export async function getAnnualLeaveBalance(userId: string, year: number) {
  const [hireDate, used] = await Promise.all([
    getHireDate(userId),
    countAnnualLeaveInYear(userId, year),
  ]);
  const quota = annualLeaveQuota(hireDate, year);
  return { quota, used, remaining: Math.max(0, quota - used) };
}

/**
 * Độ dài đợt nghỉ phép liên tiếp nếu tích thêm `date` — Chủ nhật xen giữa không
 * làm đứt đợt và không được tính. Dùng để chặn nghỉ phép quá 5 ngày liền.
 */
export async function annualRunLengthWith(userId: string, date: Date): Promise<number> {
  const WINDOW_DAYS = MAX_CONSECUTIVE_ANNUAL * 2 + 4;
  const rows = await prisma.leaveDay.findMany({
    where: {
      userId,
      type: "ANNUAL",
      date: {
        gte: new Date(date.getTime() - WINDOW_DAYS * 86_400_000),
        lte: new Date(date.getTime() + WINDOW_DAYS * 86_400_000),
      },
    },
    select: { date: true },
  });

  const annual = new Set(rows.map(r => dayKey(r.date)));
  annual.add(dayKey(date));

  /** Đi từ `date` theo một hướng, đếm các ngày phép nối nhau. */
  function walk(step: number): number {
    let count  = 0;
    let cursor = new Date(date.getTime() + step * 86_400_000);
    for (let i = 0; i < WINDOW_DAYS; i++) {
      if (isSunday(cursor)) {
        cursor = new Date(cursor.getTime() + step * 86_400_000);
        continue;
      }
      if (!annual.has(dayKey(cursor))) break;
      count++;
      cursor = new Date(cursor.getTime() + step * 86_400_000);
    }
    return count;
  }

  return 1 + walk(-1) + walk(1);
}

// ── Phân quyền ─────────────────────────────────────────────────────────────

/** Người đang đăng nhập, lấy từ `session.user`. */
export type LeaveActor = {
  id:                string;
  role?:             string | null;
  managedBranchIds?: string[];
};

/**
 * Ai được xem và tích lịch nghỉ của ai: bản thân mỗi người, Admin với tất cả,
 * FM với nhân sự thuộc cơ sở mình quản lý. CEO/COO không dùng lịch nghỉ.
 */
export async function canManageLeaveOf(
  actor:        LeaveActor,
  targetUserId: string,
): Promise<boolean> {
  if (targetUserId === actor.id) return true;
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "FM") return false;

  const managed = actor.managedBranchIds ?? [];
  if (managed.length === 0) return false;

  const target = await prisma.user.findUnique({
    where:  { id: targetUserId },
    select: { branchId: true },
  });
  return !!target?.branchId && managed.includes(target.branchId);
}
