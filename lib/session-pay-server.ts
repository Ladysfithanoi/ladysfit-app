import { getTaughtSessions, getSessionAdjustments } from "@/lib/pt-session-count";
import { tallyShows, type ShowBuckets } from "@/lib/session-pay";

// Phần ĐỌC DỮ LIỆU của tiền buổi dạy — tách khỏi lib/session-pay vì file kia
// còn được màn tạo bảng lương (client component) dùng để tính nhẩm, mà kéo theo
// prisma vào bundle trình duyệt thì trang hỏng ngay khi mở.

/**
 * Số buổi dạy tính lương của một PT trong tháng, đọc thẳng từ dữ liệu buổi tập
 * ngay lúc gọi. Đây là nguồn để bảng lương PT tự cập nhật theo thời gian thực:
 * PT check-out xong một buổi là lần mở bảng lương kế tiếp đã thấy tiền.
 */
export async function liveShowsForUser(
  userId: string,
  month:  number,
  year:   number,
): Promise<ShowBuckets> {
  const gte = new Date(year, month - 1, 1);
  const lt  = new Date(year, month, 1);

  const [taught, adjustments] = await Promise.all([
    getTaughtSessions([userId], gte, lt),
    getSessionAdjustments([userId], month, year),
  ]);

  return tallyShows(taught, adjustments);
}
