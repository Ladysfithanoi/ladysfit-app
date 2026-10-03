/**
 * Đưa ngày trên phiếu check-in gói L4 cũ (100 buổi, PT Lưu Thị Ngân) của Bùi
 * Phương Linh về đúng ngày tập thật (03/10/2026, Admin xác nhận).
 *
 * Bối cảnh: phần sửa tay của phiếu (lần lưu gần nhất 24/09) dời ngày ~30 buổi app
 * ghi — đa số lùi về ngày của buổi liền trước, như gõ lệch một dòng; buổi 07/09
 * bị ghi thành 07/08. Lương đếm theo ngày thật nên tháng 9 ra 9 buổi, còn phiếu
 * chỉ hiện 8.
 *
 * Với mỗi buổi app ghi có "date" sửa tay KHÁC NGÀY (giờ VN) với buổi thật:
 *   - bỏ "date"        → phiếu hiện lại ngày + giờ vào thật.
 *   - bỏ "checkOutAt"  → giờ ra sửa tay đi kèm ngày lệch, cũng lệch theo; dùng
 *                        giờ ra thật.
 * Số cân sửa tay giữ nguyên. Dòng không còn gì → bỏ cả dòng. Buổi ghi tay
 * (extraRows) không đụng tới.
 *
 * Chạy:
 *   npx tsx --env-file=.env scripts/fix-bui-phuong-linh-l4-sheet-dates.ts           # chỉ xem
 *   npx tsx --env-file=.env scripts/fix-bui-phuong-linh-l4-sheet-dates.ts --apply   # thực thi
 */
import { prisma } from "@/lib/prisma";
import { sheetDay } from "@/lib/checkin-sheet";

const ENROLLMENT_ID = "cmsu5naua000vunb228rju0vu"; // L4 100 buổi, bắt đầu 06/04/2026
const APPLY = process.argv.includes("--apply");

type RowOverride = { date?: string; checkOutAt?: string | null; weight?: number | null };

(async () => {
  const o = await prisma.checkinSheetOverride.findUniqueOrThrow({ where: { enrollmentId: ENROLLMENT_ID } });
  console.log("Bản gốc cột rows (để khôi phục nếu cần):\n" + o.rows + "\n");

  const rows = JSON.parse(o.rows ?? "{}") as Record<string, RowOverride>;
  const logs = await prisma.workoutLog.findMany({
    where: { id: { in: Object.keys(rows) } },
    select: { id: true, sessionDate: true },
  });

  let fixed = 0;
  for (const l of logs) {
    const r = rows[l.id];
    const real = l.sessionDate.toISOString();
    if (!r.date || sheetDay(r.date) === sheetDay(real)) continue;
    console.log(`  ${sheetDay(r.date)} → ${sheetDay(real)}  (${l.id})`);
    delete r.date;
    delete r.checkOutAt;
    if (Object.keys(r).length === 0) delete rows[l.id];
    fixed++;
  }
  console.log(`\n${APPLY ? "ĐÃ SỬA" : "SẼ SỬA"}: ${fixed} buổi về ngày thật.`);

  if (APPLY && fixed > 0) {
    await prisma.checkinSheetOverride.update({ where: { id: o.id }, data: { rows: JSON.stringify(rows) } });
  }
})().finally(() => prisma.$disconnect());
