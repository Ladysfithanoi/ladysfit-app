/**
 * Xoá buổi "Buổi 16 — Cardio" 01/08/2026 11:15 của Nguyễn Thị Phương Anh, ghi là
 * Vũ Văn Đạt dạy hộ — Admin xác nhận buổi này ghi nhầm (24/09/2026).
 *
 * Đi ĐÚNG đường xoá của app (DELETE /api/clients/[id]/workout-logs/[logId]):
 *   1. Hoàn 1 buổi vào đúng lộ trình đã trừ lúc check-in (reversePackageSession).
 *   2. Chụp vào thùng rác (captureTrash) — khôi phục được từ màn Thùng rác.
 *   3. Xoá bản ghi → rời phiếu check-in và bảng lương của Đạt.
 *
 * Chạy:
 *   npx tsx --env-file=.env scripts/delete-phuong-anh-0108-dat-session.ts           # chỉ xem
 *   npx tsx --env-file=.env scripts/delete-phuong-anh-0108-dat-session.ts --apply   # thực thi
 */
import { prisma } from "@/lib/prisma";
import { reversePackageSession } from "@/lib/workout-session";
import { captureTrash } from "@/lib/trash";

const CLIENT_ID = "cmrddi47x001rcqy56a83lnxg"; // Nguyễn Thị Phương Anh
const LOG_ID = "cms9uzbnp0001dcj7f2t4qwpv";    // Buổi 16 — Cardio, 01/08/2026 11:15, Vũ Văn Đạt
const APPLY = process.argv.includes("--apply");

(async () => {
  const log = await prisma.workoutLog.findFirst({
    where: { id: LOG_ID, clientId: CLIENT_ID },
    include: { session: { select: { sessionName: true } }, createdBy: { select: { name: true } } },
  });
  if (!log) { console.log("Không còn buổi này — đã xoá từ trước."); return; }
  const enr = log.packageEnrollmentId
    ? await prisma.packageEnrollment.findUnique({ where: { id: log.packageEnrollmentId } })
    : null;
  console.log(`${log.session.sessionName} · ${log.sessionDate.toISOString()} · ${log.createdBy.name} · ${log.status}`);
  console.log(`Gói ${enr?.packageName} ${enr?.contractCode}: đã dùng ${enr?.sessionsUsed}/${enr?.sessions}, packageCounted=${log.packageCounted}`);
  if (!APPLY) return;

  const actor = await prisma.user.findFirst({
    where: { email: "ladysfit.mastertrainer@gmail.com" }, select: { id: true, name: true, role: true },
  });
  const pkg = log.packageCounted ? await reversePackageSession(CLIENT_ID, log.packageEnrollmentId) : null;
  await captureTrash("WORKOUT_LOG", LOG_ID, { id: actor?.id, name: actor?.name, role: actor?.role });
  await prisma.workoutLog.delete({ where: { id: LOG_ID } });
  console.log("ĐÃ XOÁ.", JSON.stringify(pkg));
})().finally(() => prisma.$disconnect());
