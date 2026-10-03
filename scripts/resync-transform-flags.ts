/**
 * Tính lại cờ "đã transform" (hasTransformed) của mọi khách từ nhật ký cân
 * (03/10/2026, Admin xác nhận).
 *
 * Bối cảnh: cờ từng "chỉ bật, không tắt", nên một lần cân gõ nhầm — Nguyễn Thị
 * Hồng Hạnh 55,5 kg thay vì ~89 kg — bật cờ rồi xoá đi vẫn đếm transform mãi.
 * Rà ngày 03/10 có 17 khách mang cờ mà không còn lần cân nào giảm đủ 7 kg. Từ nay
 * lib/weight-log (syncTransformFlag) tính lại cờ mỗi khi cân đổi; script này đưa
 * dữ liệu cũ về cùng luật bằng chính hàm đó.
 *
 * Khách chưa có lần cân nào giữ nguyên cờ (không có dữ liệu để kết luận).
 *
 * Chạy:
 *   npx tsx --env-file=.env scripts/resync-transform-flags.ts           # chỉ xem
 *   npx tsx --env-file=.env scripts/resync-transform-flags.ts --apply   # thực thi
 */
import { prisma } from "@/lib/prisma";
import { syncTransformFlag, WEIGHT_MIN } from "@/lib/weight-log";
import { TRANSFORM_LOSS_KG } from "@/lib/transform-credit";

const APPLY = process.argv.includes("--apply");

(async () => {
  const clients = await prisma.client.findMany({
    select: {
      id: true, fullName: true, initialWeight: true, hasTransformed: true,
      assignedPT: { select: { name: true } },
      weightLogs: { select: { weight: true } },
    },
  });

  const changes = clients.filter((c) => {
    if (c.weightLogs.length === 0) return false;
    const should = c.weightLogs.some((l) => l.weight >= WEIGHT_MIN && l.weight <= c.initialWeight - TRANSFORM_LOSS_KG);
    return should !== c.hasTransformed;
  });

  for (const c of changes) {
    const min = Math.min(...c.weightLogs.map((l) => l.weight).filter((w) => w >= WEIGHT_MIN));
    console.log(`${c.hasTransformed ? "TẮT" : "BẬT"}  ${c.fullName} (${c.assignedPT?.name ?? "—"}) — ban đầu ${c.initialWeight}, thấp nhất ${min}`);
  }
  console.log(`\n${APPLY ? "ĐÃ SỬA" : "SẼ SỬA"}: ${changes.length} khách.`);

  if (APPLY) for (const c of changes) await syncTransformFlag(c.id);
})().finally(() => prisma.$disconnect());
