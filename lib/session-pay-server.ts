import { getTaughtSessions, getSessionAdjustments, keepBranchSessions } from "@/lib/pt-session-count";
import { tallyShows, type ShowBuckets } from "@/lib/session-pay";
import { vnMonthStart } from "@/lib/format-date";

// Phần ĐỌC DỮ LIỆU của tiền buổi dạy — tách khỏi lib/session-pay vì file kia
// còn được màn tạo bảng lương (client component) dùng để tính nhẩm, mà kéo theo
// prisma vào bundle trình duyệt thì trang hỏng ngay khi mở.

/**
 * Số buổi dạy tính lương của một PT trong tháng, đọc thẳng từ dữ liệu buổi tập
 * ngay lúc gọi. Đây là nguồn để bảng lương PT tự cập nhật theo thời gian thực:
 * PT check-out xong một buổi là lần mở bảng lương kế tiếp đã thấy tiền.
 *
 * `branchId` (Admin làm nhiều cơ sở): chỉ đếm buổi của khách thuộc cơ sở đó —
 * xem keepBranchSessions.
 */
export async function liveShowsForUser(
  userId:    string,
  month:     number,
  year:      number,
  branchId?: string | null,
): Promise<ShowBuckets> {
  const gte = vnMonthStart(year, month);
  const lt  = vnMonthStart(year, month + 1);

  const [taught, adjustments] = await Promise.all([
    getTaughtSessions([userId], gte, lt).then((rows) => keepBranchSessions(rows, branchId)),
    getSessionAdjustments([userId], month, year).then((rows) => keepBranchSessions(rows, branchId)),
  ]);

  return tallyShows(taught, adjustments);
}
