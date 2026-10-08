/**
 * CƠ SỞ LÀM VIỆC CỦA NGƯỜI LÀM Ở NHIỀU CƠ SỞ — Admin, và nhân sự STAFF có chức
 * vụ "làm được nhiều cơ sở" (Lao công, Marketing… — JobPosition.multiBranch).
 *
 * Một người, một tài khoản; danh sách cơ sở lưu ở FMBranchAssignment (cùng bảng
 * với FM). User.branchId là cơ sở chính và luôn đứng đầu danh sách, để các chỗ
 * cũ chỉ đọc branchId vẫn đúng. Người đó chỉ có mặt ở cơ sở được chọn: danh
 * sách nhân sự, chuyển giao, lịch nghỉ và bảng lương — mỗi cơ sở một bảng lương
 * (Admin: dạy khách cơ sở nào tính buổi dạy ở cơ sở đó — lib/salary-live
 * payBranchScope; STAFF: lương cơ bản cấu hình riêng từng cơ sở).
 *
 * FM KHÔNG đi qua đây: FM gắn cơ sở quản lý bằng cùng bảng nhưng có quy tắc
 * riêng (bắt buộc 1–5 cơ sở, branchId để trống, một bảng lương mỗi tháng).
 */

/** Quyền được gán nhiều cơ sở làm việc (không tính FM). */
export const WORK_BRANCH_ROLES = ["ADMIN", "STAFF"] as const;

/** Người này có dùng danh sách cơ sở làm việc không. */
export function usesWorkBranches(role: string | null | undefined, positionMultiBranch: boolean | null | undefined): boolean {
  return role === "ADMIN" || (role === "STAFF" && !!positionMultiBranch);
}

/**
 * Danh sách cơ sở gửi lên → danh sách lưu, cơ sở chính đứng đầu.
 * `branchId` được chọn làm cơ sở chính nếu nó có trong danh sách (hoặc danh
 * sách bỏ trống — form cũ chỉ gửi một cơ sở).
 */
export function workBranchList(
  managedBranchIds: unknown,
  branchId: unknown,
): string[] {
  const list = Array.isArray(managedBranchIds)
    ? managedBranchIds.filter((b): b is string => typeof b === "string" && b !== "")
    : [];
  const home = typeof branchId === "string" && branchId !== "" ? branchId : null;
  if (list.length === 0) return home ? [home] : [];
  const unique = Array.from(new Set(list));
  return home && unique.includes(home) ? [home, ...unique.filter((b) => b !== home)] : unique;
}

/** Cơ sở làm việc hiện tại của một người (đã gán thì theo danh sách, chưa thì branchId). */
export function currentWorkBranches(u: { branchId: string | null; managedBranches: { branchId: string }[] }): string[] {
  const assigned = u.managedBranches.map((m) => m.branchId);
  if (assigned.length > 0) return assigned;
  return u.branchId ? [u.branchId] : [];
}

/**
 * Điều kiện Prisma trên User: người (không phải FM) làm ở một trong các cơ sở
 * này — theo branchId, hoặc Admin/STAFF nhiều cơ sở được gán cơ sở đó.
 */
export function worksAtBranches(branchIds: string[]) {
  return {
    OR: [
      { branchId: { in: branchIds } },
      { role: { in: [...WORK_BRANCH_ROLES] }, managedBranches: { some: { branchId: { in: branchIds } } } },
    ],
  };
}
