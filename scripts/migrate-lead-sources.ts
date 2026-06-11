/**
 * One-time data migration: đổi tên nguồn lead cũ sang tên đã thống nhất.
 *
 * Sau khi gộp danh sách nguồn dùng chung (lib/lead-sources.ts), các bản ghi cũ
 * vẫn lưu tên cũ và sẽ không khớp dropdown mới. Script này cập nhật:
 *   - SalesLead.source        (Bảng Setup — Setup Doanh số)
 *   - ConsultationInfo.knowLDFVia (Biết LDF qua đâu? — Tư vấn - CIF)
 *
 * Ánh xạ:
 *   "Facebook" → "Facebook Page"
 *   "Outdoor"  → "Tờ rơi (Vouche)"
 *   "Tờ rơi"   → "Tờ rơi (Vouche)"
 *
 * An toàn để chạy lại (idempotent): chỉ đổi đúng các giá trị cũ ở trên.
 *
 * Run once:  npx tsx scripts/migrate-lead-sources.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MAP: Record<string, string> = {
  "Facebook": "Facebook Page",
  "Outdoor": "Tờ rơi (Vouche)",
  "Tờ rơi": "Tờ rơi (Vouche)",
};

async function main() {
  let leadTotal = 0;
  let cifTotal = 0;

  for (const [oldVal, newVal] of Object.entries(MAP)) {
    const lead = await prisma.salesLead.updateMany({
      where: { source: oldVal },
      data: { source: newVal },
    });
    if (lead.count > 0) {
      console.log(`  SalesLead.source: "${oldVal}" → "${newVal}"  (${lead.count})`);
      leadTotal += lead.count;
    }

    const cif = await prisma.consultationInfo.updateMany({
      where: { knowLDFVia: oldVal },
      data: { knowLDFVia: newVal },
    });
    if (cif.count > 0) {
      console.log(`  ConsultationInfo.knowLDFVia: "${oldVal}" → "${newVal}"  (${cif.count})`);
      cifTotal += cif.count;
    }
  }

  console.log(`\nDone. SalesLead updated: ${leadTotal}, ConsultationInfo updated: ${cifTotal}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
