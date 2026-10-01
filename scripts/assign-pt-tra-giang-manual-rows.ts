/**
 * Gán người dạy cho các buổi ghi tay trên phiếu check-in của khách Trịnh Trà Giang
 * (FM Vũ Ngọc Duy), lộ trình L4.
 *
 * Bối cảnh: 9 buổi tháng 6 được thêm tay vào phiếu nhưng để trống người dạy, nên
 * in lên phiếu (phiếu ≈ KH đi tập) mà không vào "Số buổi PT" — lib/manual-sheet-
 * sessions chỉ tính công dòng có ptId. Mọi buổi app ghi của khách này đều do Duy
 * dạy, và chính Duy là người thêm các dòng đó, nên ghi công cho Duy.
 *
 * Chỉ điền dòng còn trống người dạy; dòng đã có ptId giữ nguyên. Chạy lại vô hại.
 *
 * Chạy: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/assign-pt-tra-giang-manual-rows.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ENROLLMENT_ID = "0c87c7bd-aee1-4cfc-8d45-c4050d45af2d";
const PT_ID = "cmp2ltqt20006i90ilbyy96yh"; // Vũ Ngọc Duy
const APPLY = process.argv.includes("--apply");

async function main() {
  const pt = await prisma.user.findUniqueOrThrow({ where: { id: PT_ID }, select: { name: true } });
  const o = await prisma.checkinSheetOverride.findUniqueOrThrow({ where: { enrollmentId: ENROLLMENT_ID } });
  const rows = JSON.parse(o.extraRows ?? "[]") as { date: string; ptId?: string; ptName?: string }[];

  let changed = 0;
  for (const r of rows) {
    if (r.ptId) continue;
    r.ptId = PT_ID;
    r.ptName = r.ptName || pt.name || "";
    changed++;
    console.log(`  ${r.date.slice(0, 10)} → ${pt.name}`);
  }
  console.log(`${changed}/${rows.length} dòng ghi tay được gán người dạy.`);

  if (APPLY && changed > 0) {
    await prisma.checkinSheetOverride.update({ where: { id: o.id }, data: { extraRows: JSON.stringify(rows) } });
    console.log("Đã lưu.");
  } else if (!APPLY) {
    console.log("Chạy thử — thêm --apply để lưu.");
  }
}

main().finally(() => prisma.$disconnect());
