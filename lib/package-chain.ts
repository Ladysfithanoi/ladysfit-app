import { chargePriority } from "@/lib/checkin-eligibility";

const DAY_MS = 86_400_000;

/**
 * NGÀY CỦA CÁC GÓI MUA CÙNG MỘT LÚC — nối đuôi nhau, không trùng.
 *
 * Khách mua nhiều gói một lần (chốt tư vấn, lead "L1+L3") thì gói sau bắt đầu
 * ngay ngày hôm sau ngày kết thúc của gói trước: start(n) = end(n−1) + 1 ngày,
 * end = start + durationDays (cùng công thức với mọi chỗ tạo gói). Trước đây mọi
 * gói cùng lấy ngày ký làm ngày bắt đầu, nên gói sau tốn hạn trong lúc khách còn
 * đang tập gói trước.
 *
 * Thứ tự nối theo đúng thứ tự trừ buổi (chargePriority: L1/L2 → L3/L4 →
 * L5/Loyalfit), cùng bậc giữ thứ tự nhập — để gói đang chạy cũng là gói đang
 * bị trừ buổi. Trả về theo đúng thứ tự mảng đầu vào.
 *
 * Gói có `fixed` (đã tồn tại, vd FM tạo tay trước khi nhập lead) giữ nguyên ngày
 * của nó; gói kế tiếp nối sau ngày kết thúc của gói đó.
 */
export function chainPackageDates<T extends {
  packageName: string;
  durationDays: number;
  fixed?: { startDate: Date | null; endDate: Date | null } | null;
}>(
  packages: T[],
  firstStart: Date,
): { startDate: Date; endDate: Date }[] {
  const order = packages
    .map((p, i) => ({ p, i }))
    .sort((a, b) => chargePriority(a.p.packageName) - chargePriority(b.p.packageName) || a.i - b.i);

  const out: { startDate: Date; endDate: Date }[] = new Array(packages.length);
  let start = firstStart;
  for (const { p, i } of order) {
    if (p.fixed?.startDate && p.fixed.endDate) {
      out[i] = { startDate: p.fixed.startDate, endDate: p.fixed.endDate };
      start = new Date(p.fixed.endDate.getTime() + DAY_MS);
      continue;
    }
    const endDate = new Date(start.getTime() + p.durationDays * DAY_MS);
    out[i] = { startDate: start, endDate };
    start = new Date(endDate.getTime() + DAY_MS);
  }
  return out;
}
