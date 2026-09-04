/**
 * Ai được xem/sửa dữ liệu lương.
 *
 * COO xem lương của MỌI cơ sở — màn Quỹ lương đã hiện đủ bảng, nút Xuất Excel và
 * nút Chi tiết cho họ từ lâu. Nhưng các route lương lại chỉ kiểm `role === "FM"`,
 * nên COO bấm vào là nhận 403 và màn hình không hiện gì. Gom luật vào một chỗ để
 * không còn route nào quên một vai trò nữa.
 *
 * Ranh giới giữ nguyên như giao diện đang thể hiện:
 *   • FM  — quản lý lương của các cơ sở mình phụ trách, tạo được bảng lương tháng.
 *   • COO — xem và đối soát mọi cơ sở, KHÔNG tạo bảng lương (nút đó vốn đã ẩn).
 *   • ADMIN — dữ liệu chi tiết buổi dạy (đối soát), như trước.
 */

/** Xem bảng lương, chi tiết buổi dạy, xuất Excel. */
export function canReadSalary(role: string | null | undefined): boolean {
  return role === "FM" || role === "COO";
}

/** Tạo bảng lương tháng, sửa cấu hình lương — việc của FM tại cơ sở của họ. */
export function canManageSalary(role: string | null | undefined): boolean {
  return role === "FM";
}

/**
 * Xem/sửa chi tiết buổi dạy của một PT (kèm ảnh check-in, transform).
 * Chính PT đó luôn xem được bài của mình.
 */
export function canAccessSessionDetail(
  role: string | null | undefined,
  viewerId: string,
  ptId: string
): boolean {
  return role === "FM" || role === "ADMIN" || role === "COO" || viewerId === ptId;
}
