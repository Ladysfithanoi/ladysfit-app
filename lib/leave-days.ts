/**
 * Lịch nghỉ của nhân sự.
 *
 * Mỗi ngày nhân sự (hoặc FM/Admin) tích trên lịch là một dòng trong `leave_days`.
 * Số ngày nghỉ của một tháng được trừ thẳng vào NGÀY CÔNG THỰC TẾ của bảng lương
 * tháng đó — xem lib/work-days.ts cho cách ngày công chia lương cứng.
 *
 * Chủ nhật KHÔNG được tính là ngày nghỉ: ngày công chuẩn đã trừ sẵn Chủ nhật nên
 * tích thêm sẽ trừ lương hai lần.
 *
 * Cột `date` là DATE của Postgres nên mọi mốc thời gian ở đây đều dựng bằng UTC —
 * dùng giờ địa phương sẽ lệch một ngày khi máy chủ chạy ở múi giờ khác.
 */

import { prisma } from "@/lib/prisma";

/** Nửa đêm UTC của một ngày dương lịch. `month` 1-based, tự tràn sang năm sau. */
export function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Khoảng ngày của một tháng, dùng trực tiếp cho filter `date` của Prisma. */
export function monthDateRange(month: number, year: number) {
  return { gte: utcDay(year, month, 1), lt: utcDay(year, month + 1, 1) };
}

/** `true` nếu là Chủ nhật — ngày đó vốn không tính công nên không tính nghỉ. */
export function isSunday(date: Date): boolean {
  return date.getUTCDay() === 0;
}

/** Các ngày trong tháng (1–31) đã tích nghỉ của một nhân sự. */
export async function getLeaveDaysOfMonth(
  userId: string,
  month:  number,
  year:   number,
): Promise<number[]> {
  const rows = await prisma.leaveDay.findMany({
    where:   { userId, date: monthDateRange(month, year) },
    orderBy: { date: "asc" },
    select:  { date: true },
  });
  return rows.map(r => r.date.getUTCDate());
}

/**
 * Số ngày nghỉ tính công của từng nhân sự trong tháng (đã bỏ Chủ nhật).
 * Nhân sự không có ngày nghỉ nào vẫn có khoá trong kết quả với giá trị 0.
 */
export async function countLeaveDaysByUser(
  userIds: string[],
  month:   number,
  year:    number,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const id of userIds) counts[id] = 0;
  if (userIds.length === 0) return counts;

  const rows = await prisma.leaveDay.findMany({
    where:  { userId: { in: userIds }, date: monthDateRange(month, year) },
    select: { userId: true, date: true },
  });
  for (const row of rows) {
    if (isSunday(row.date)) continue;
    counts[row.userId] = (counts[row.userId] ?? 0) + 1;
  }
  return counts;
}

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
