/**
 * Dọn các "sửa tay" giả trên phiếu check-in — những bản sửa không ai thật sự sửa.
 *
 * Bối cảnh: trình sửa phiếu bản cũ (trước khi có ô "Giờ vào", 11/09/2026) mỗi lần
 * bấm Lưu thì ghi lại MỌI dòng buổi app ghi, và ghi ngày thành nửa đêm (chỉ ngày,
 * không giờ). Kết quả: cả phiếu mất giờ vào; hai buổi cùng một ngày — như 01/08/2026
 * của Nguyễn Thị Phương Anh (07:10 Vũ Ngọc Duy, 11:15 Vũ Văn Đạt) — in ra y hệt
 * nhau, nhìn như một buổi bị ghi hai lần.
 *
 * lib/checkin-sheet.ts (applyRowOverride) đã vá cách ĐỌC: ngày sửa tay chỉ-có-ngày
 * không còn xoá được giờ ký thật. Script này dọn nốt DỮ LIỆU để bản sửa lưu trong
 * DB nói đúng điều FM đã sửa, không hơn:
 *   - "date" chỉ-có-ngày và CÙNG NGÀY (giờ VN) với buổi thật  → bỏ.
 *   - "checkOutAt" trùng giờ ra thật tới từng phút            → bỏ.
 *   - "weight" null (= dùng số cân gốc)                       → bỏ.
 *   - dòng không còn gì                                        → bỏ cả dòng.
 * Bản sửa khác ngày, khác giờ, có số cân — giữ nguyên.
 *
 * Chạy:
 *   npx tsx --env-file=.env scripts/strip-bare-day-row-overrides.ts           # chỉ xem
 *   npx tsx --env-file=.env scripts/strip-bare-day-row-overrides.ts --apply   # thực thi
 */
import { PrismaClient } from "@prisma/client";
import { isBareDay, sheetDay, sheetTime } from "../lib/checkin-sheet";

const prisma = new PrismaClient({ log: ["error"] });
const APPLY = process.argv.includes("--apply");

(async () => {
  const all = await prisma.checkinSheetOverride.findMany({ select: { id: true, enrollmentId: true, rows: true } });
  let sheets = 0, dates = 0, outs = 0, dropped = 0;
  for (const o of all) {
    if (!o.rows) continue;
    const rows = JSON.parse(o.rows) as Record<string, { date?: string; checkOutAt?: string | null; weight?: number | null }>;
    const ids = Object.keys(rows);
    if (ids.length === 0) continue;
    const logs = await prisma.workoutLog.findMany({
      where: { id: { in: ids } }, select: { id: true, sessionDate: true, checkOutAt: true },
    });
    const byId = new Map(logs.map((l) => [l.id, l]));
    let changed = false;
    for (const id of ids) {
      const r = rows[id];
      const l = byId.get(id);
      if (!l) continue;
      const real = l.sessionDate.toISOString();
      if (r.date && isBareDay(r.date) && sheetDay(r.date) === sheetDay(real)) { delete r.date; dates++; changed = true; }
      if (r.checkOutAt && l.checkOutAt && sheetDay(r.checkOutAt) === sheetDay(l.checkOutAt.toISOString())
          && sheetTime(r.checkOutAt) === sheetTime(l.checkOutAt.toISOString())) { delete r.checkOutAt; outs++; changed = true; }
      if (r.weight === null) { delete r.weight; changed = true; }
      if (Object.keys(r).length === 0) { delete rows[id]; dropped++; changed = true; }
    }
    if (!changed) continue;
    sheets++;
    if (APPLY) await prisma.checkinSheetOverride.update({ where: { id: o.id }, data: { rows: JSON.stringify(rows) } });
  }
  console.log(`${APPLY ? "ĐÃ SỬA" : "SẼ SỬA"}: ${sheets} phiếu — bỏ ${dates} ngày chỉ-có-ngày, ${outs} giờ ra trùng gốc, ${dropped} dòng rỗng.`);
})().finally(() => prisma.$disconnect());
