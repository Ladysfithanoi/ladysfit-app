/**
 * Chuyển buổi tập 26/09/2026 14:22 (giờ VN) từ hồ sơ Bùi Thị Hằng sang đúng khách
 * Lê Khánh Vân. Cả hai là khách của PT Vũ Mai Ly.
 *
 * Bối cảnh: ngày 26/09 hồ sơ chị Hằng có hai buổi (11:18 và 14:22). Chữ ký check-in
 * buổi 14:22 không phải chữ "Hằng" như mọi buổi khác của chị Hằng, mà trùng khớp
 * với chữ ký của chị Vân (11 buổi gần nhất của chị Vân đều cùng một nét). Chị Vân
 * không có buổi nào ngày 26/09 và hay tập khoảng 15h. Kết luận: Mai Ly mở nhầm hồ
 * sơ chị Hằng để check-in cho chị Vân.
 *
 * Sau khi chạy:
 *   • Buổi thuộc chị Vân, lộ trình L2 của chị Vân, gắn vào giáo án còn trống
 *     "Buổi 30 — Tạ 1" (tuần 6) — đúng chỗ trống giữa Buổi 29 (27/09) và Buổi 31.
 *   • Chị Hằng được hoàn 1 buổi L4, chị Vân bị trừ 1 buổi L2.
 *   • Chữ ký, ảnh check-out, giờ vào/ra, người dạy giữ nguyên. Số liệu bài tập giữ
 *     nguyên nhưng bỏ liên kết tới bài trong giáo án của chị Hằng (movementId) để
 *     gợi ý tạ buổi sau của chị Hằng không đọc số của chị Vân.
 *   • Thông báo "buổi tiếp theo" đã gửi cho chị Hằng từ buổi này bị xoá.
 *   • Lương: buổi vẫn ghi công Mai Ly, nhưng tính theo giá L2 (60k) thay vì L4 (100k).
 *
 * Chạy: TS_NODE_BASEURL=. npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"CommonJS"}' scripts/move-hang-0926-session-to-van.ts [--apply]
 */
import { prisma } from "@/lib/prisma";
import { refreshClientChurnStatus } from "@/lib/client-status";

const APPLY = process.argv.includes("--apply");

const LOG_ID     = "cmui2bgai00038sepsonbysgo";
const HANG_ID    = "cmpapfrx40002ni5dn6v8cd5i";
const VAN_ID     = "cmstu5s370002ng9msncdha9i";
const VAN_PKG_ID = "c88eb58d-7638-4b4b-8566-96908a446916";
const TARGET_SESSION_NAME = "Buổi 30 — Tạ 1";

async function main() {
  const log = await prisma.workoutLog.findUniqueOrThrow({
    where: { id: LOG_ID },
    select: { id: true, clientId: true, status: true, packageCounted: true, packageEnrollmentId: true, sessionDate: true },
  });
  if (log.clientId !== HANG_ID) { console.log("Buổi không còn ở hồ sơ chị Hằng — bỏ qua."); return; }
  if (log.status !== "COMPLETED" || !log.packageCounted || !log.packageEnrollmentId) {
    console.log("Buổi không ở trạng thái mong đợi — dừng.", log);
    return;
  }

  const [hangPkg, vanPkg] = await Promise.all([
    prisma.packageEnrollment.findUniqueOrThrow({ where: { id: log.packageEnrollmentId } }),
    prisma.packageEnrollment.findUniqueOrThrow({ where: { id: VAN_PKG_ID } }),
  ]);
  if (hangPkg.clientId !== HANG_ID || vanPkg.clientId !== VAN_ID) { console.log("Lộ trình không khớp — dừng."); return; }

  // Giáo án đích: buổi "Buổi 30 — Tạ 1" của chị Vân, chưa có buổi tập nào.
  const target = await prisma.workoutSession.findFirst({
    where: { sessionName: TARGET_SESSION_NAME, program: { clientId: VAN_ID } },
    select: { id: true, weekId: true, programId: true, workoutLogs: { select: { id: true } } },
  });
  if (!target || !target.weekId) { console.log("Không tìm thấy giáo án đích — dừng."); return; }
  const weekId = target.weekId;
  if (target.workoutLogs.length > 0) { console.log("Giáo án đích đã có buổi tập — dừng."); return; }

  const notif = await prisma.workoutNotification.count({ where: { workoutLogId: LOG_ID } });
  console.log(`Hằng ${hangPkg.packageName}: ${hangPkg.sessionsUsed} → ${hangPkg.sessionsUsed - 1}`);
  console.log(`Vân  ${vanPkg.packageName}: ${vanPkg.sessionsUsed} → ${vanPkg.sessionsUsed + 1}`);
  console.log(`Gắn vào "${TARGET_SESSION_NAME}" (${target.id}); thông báo cần xoá: ${notif}`);
  if (!APPLY) { console.log("Chạy thử. Thêm --apply để ghi."); return; }

  await prisma.$transaction([
    prisma.packageEnrollment.update({
      where: { id: hangPkg.id },
      data: {
        sessionsUsed: hangPkg.sessionsUsed - 1,
        ...(hangPkg.status === "COMPLETED" && hangPkg.sessionsUsed - 1 < hangPkg.sessions ? { status: "ACTIVE" } : {}),
      },
    }),
    prisma.packageEnrollment.update({
      where: { id: vanPkg.id },
      data: {
        sessionsUsed: vanPkg.sessionsUsed + 1,
        ...(vanPkg.sessionsUsed + 1 >= vanPkg.sessions ? { status: "COMPLETED" } : {}),
      },
    }),
    prisma.workoutNotification.deleteMany({ where: { workoutLogId: LOG_ID } }),
    prisma.workoutSetLog.updateMany({ where: { workoutLogId: LOG_ID }, data: { movementId: null } }),
    prisma.workoutLog.update({
      where: { id: LOG_ID },
      data: {
        clientId: VAN_ID,
        packageEnrollmentId: VAN_PKG_ID,
        programId: target.programId,
        weekId,
        sessionId: target.id,
      },
    }),
  ]);
  await refreshClientChurnStatus(HANG_ID);
  await refreshClientChurnStatus(VAN_ID);
  console.log("Đã chuyển.");
}

main().finally(() => prisma.$disconnect());
