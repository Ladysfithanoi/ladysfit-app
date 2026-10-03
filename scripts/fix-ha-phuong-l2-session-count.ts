/**
 * Đưa "Số buổi PT" và "KH đi tập" của Hà Phương (PT Kiều Cao Phước, gói L2 60
 * buổi) về đúng 58 — khớp với phiếu check-in (03/10/2026, Admin xác nhận).
 *
 * Bối cảnh: app ghi đủ 58 buổi đã check-out kèm nhật ký (30/06 → 02/10), nhưng
 * "KH đi tập" chỉ 56 vì buổi 30/06 không được gắn vào gói lúc check-in nên không
 * bị trừ. Ngày 11/09 FM chỉnh tay -2 "Số buổi PT" (tháng 9, ghi cho Phước) cho
 * khớp con số thiếu đó → Phước mất 2 buổi lương tháng 9.
 *
 *   1. Gỡ bản ghi chỉnh tay -2 — qua Thùng rác (captureTrash), đúng đường xoá của
 *      app, nên khôi phục được. Bảng lương tháng 9 của Phước được cộng lại 2 buổi.
 *   2. Gắn buổi 30/06 vào gói L2 (packageEnrollmentId), để sau này xoá/huỷ buổi đó
 *      thì hoàn buổi về đúng gói.
 *   3. sessionsUsed = 58.
 *
 * Chạy:
 *   npx tsx --env-file=.env scripts/fix-ha-phuong-l2-session-count.ts           # chỉ xem
 *   npx tsx --env-file=.env scripts/fix-ha-phuong-l2-session-count.ts --apply   # thực thi
 */
import { prisma } from "@/lib/prisma";
import { captureTrash } from "@/lib/trash";

const CLIENT_ID     = "cmr0erazy000211p1zmsz4ka0"; // Hà Phương
const ENROLLMENT_ID = "cmr0ojchy000ep4ulnt2wt2rl"; // L2 60 buổi
const ADJUSTMENT_ID = "cmtwo2bqw000110nyq364zogs"; // -2, T9/2026, Kiều Cao Phước
const LOG_3006_ID   = "cmr0esmi4001d11p1g9oxngga";
const TARGET_USED   = 58;
const APPLY = process.argv.includes("--apply");

(async () => {
  const enr = await prisma.packageEnrollment.findFirstOrThrow({
    where: { id: ENROLLMENT_ID, clientId: CLIENT_ID },
    select: { packageName: true, sessions: true, sessionsUsed: true },
  });
  const adj = await prisma.pTSessionAdjustment.findFirst({ where: { id: ADJUSTMENT_ID, enrollmentId: ENROLLMENT_ID } });
  const log = await prisma.workoutLog.findFirst({
    where: { id: LOG_3006_ID, clientId: CLIENT_ID },
    select: { sessionDate: true, status: true, packageEnrollmentId: true },
  });

  console.log(`Gói ${enr.packageName}: KH đi tập ${enr.sessionsUsed}/${enr.sessions} → ${TARGET_USED}`);
  console.log("Chỉnh tay cần gỡ:", adj ? `${adj.delta} (T${adj.month}/${adj.year})` : "(đã gỡ từ trước)");
  console.log("Buổi 30/06:", log);

  if (!APPLY) { console.log("\nChỉ xem — thêm --apply để thực thi."); return; }

  if (adj) {
    await captureTrash("PT_SESSION_ADJUSTMENT", adj.id, { name: "Script sửa dữ liệu", role: "ADMIN" });
    await prisma.pTSessionAdjustment.delete({ where: { id: adj.id } });
  }
  if (log && !log.packageEnrollmentId) {
    await prisma.workoutLog.update({ where: { id: LOG_3006_ID }, data: { packageEnrollmentId: ENROLLMENT_ID } });
  }
  await prisma.packageEnrollment.update({ where: { id: ENROLLMENT_ID }, data: { sessionsUsed: TARGET_USED } });
  console.log("\nĐã xong.");
})().finally(() => prisma.$disconnect());
