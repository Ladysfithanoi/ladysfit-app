/**
 * CƠ SỞ LÀM VIỆC CỦA ADMIN — Admin làm ở nhiều cơ sở như FM.
 *
 * Danh sách lưu ở FMBranchAssignment (cùng bảng với FM); User.branchId là cơ sở
 * chính và luôn đứng đầu danh sách, để các chỗ cũ chỉ đọc branchId vẫn đúng.
 * Quyền Admin vẫn là toàn hệ thống — danh sách này chỉ quyết định Admin hiện ở
 * nhân sự / bảng lương của cơ sở nào. Mỗi cơ sở một bảng lương, dạy khách cơ sở
 * nào ăn tiền buổi dạy ở cơ sở đó (lib/salary-live payBranchScope).
 *
 * `branchId` được chọn làm cơ sở chính nếu nó có trong danh sách (hoặc danh
 * sách bỏ trống — form cũ chỉ gửi một cơ sở).
 */
export function adminWorkBranches(
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
