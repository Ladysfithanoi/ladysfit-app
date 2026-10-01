/**
 * Huỷ buổi check-in trùng ngày 07/09/2026 của khách Ninh Thị Minh Hằng (lộ trình
 * L2) và hoàn lại 1 buổi cho khách.
 *
 * Bối cảnh: ngày 07/09 có hai buổi cách nhau 1 tiếng (10:13 và 11:12 giờ VN), cả
 * hai do Trần Duy Nam mở và đều đã đóng buổi. Theo xác nhận của chủ phòng tập,
 * đây là check-in trùng: khách chỉ tập một buổi. Buổi 10:13 là buổi bị huỷ. Trên
 * phiếu check-in, buổi này đang bị sửa ngày thành 05/09; dòng sửa đó được gỡ đi
 * vì buổi không còn nữa.
 *
 * Huỷ = status VOID, packageCounted = false (KHÔNG xoá): buổi ra khỏi "Số buổi PT"
 * và lương của Nam, nhưng nhật ký, chữ ký và ảnh vẫn giữ để đối chiếu. Hoàn buổi
 * đi đúng luật của luồng xoá buổi (reversePackageSession): trừ sessionsUsed của
 * đúng lộ trình đã trừ lúc check-in.
 *
 * Chạy: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/void-minh-hang-duplicate-0709.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const LOG_ID = "cmtqo22e50003hh85eizi8p4k";
const APPLY = process.argv.includes("--apply");

async function main() {
  const log = await prisma.workoutLog.findUniqueOrThrow({
    where: { id: LOG_ID },
    select: { id: true, clientId: true, status: true, packageCounted: true, packageEnrollmentId: true, sessionDate: true },
  });
  console.log("Buổi:", log);
  if (log.status !== "COMPLETED" || !log.packageCounted || !log.packageEnrollmentId) {
    console.log("Buổi không còn ở trạng thái cần huỷ — bỏ qua.");
    return;
  }

  const pkg = await prisma.packageEnrollment.findUniqueOrThrow({ where: { id: log.packageEnrollmentId } });
  const sheet = await prisma.checkinSheetOverride.findUnique({ where: { enrollmentId: pkg.id } });
  const rows = sheet?.rows ? (JSON.parse(sheet.rows) as Record<string, unknown>) : {};
  console.log(`Lộ trình ${pkg.packageName}: KH đi tập ${pkg.sessionsUsed} → ${pkg.sessionsUsed - 1}`);
  console.log("Dòng sửa trên phiếu của buổi này:", rows[LOG_ID] ?? "(không có)");

  if (!APPLY) {
    console.log("Chạy thử — thêm --apply để lưu.");
    return;
  }

  delete rows[LOG_ID];
  await prisma.$transaction([
    prisma.workoutLog.update({ where: { id: LOG_ID }, data: { status: "VOID", packageCounted: false } }),
    prisma.packageEnrollment.update({
      where: { id: pkg.id },
      data:  { sessionsUsed: { decrement: 1 }, status: "ACTIVE" },
    }),
    ...(sheet ? [prisma.checkinSheetOverride.update({ where: { id: sheet.id }, data: { rows: JSON.stringify(rows) } })] : []),
  ]);
  console.log("Đã huỷ buổi và hoàn 1 buổi.");
}

main().finally(() => prisma.$disconnect());
