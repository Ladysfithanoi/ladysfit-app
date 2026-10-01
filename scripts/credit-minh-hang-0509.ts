/**
 * Tính buổi dạy cho buổi 05/09/2026 của khách Ninh Thị Minh Hằng (lộ trình L2).
 *
 * Buổi này khách đã ký check-in và đã bị trừ buổi, nhưng PT (Trần Duy Nam) không
 * check-out nên tự huỷ sau 2 tiếng. Chủ phòng tập xác nhận khách có tập, nên
 * buổi được tính giống hệt nút "Tính buổi dạy" (POST .../workout-logs/[id]/credit):
 * status COMPLETED + confirmationMethod FM_APPROVAL. Không trừ thêm buổi của khách.
 * Chạy cùng các rào của route đó: buổi phải VOID, có chữ ký check-in, đã trừ buổi,
 * có số liệu bài tập, và trong ngày chưa có buổi nào khác được tính.
 *
 * Sau bước này: KH đi tập = phiếu check-in = Số buổi PT = 36.
 *
 * Chạy: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/credit-minh-hang-0509.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const LOG_ID = "cmto60oxz000118dvpnymx4mn";
const APPROVER_EMAIL = "tbtrungdvhn@gmail.com"; // Admin
const APPLY = process.argv.includes("--apply");

const vnDay = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);

async function main() {
  const log = await prisma.workoutLog.findUniqueOrThrow({
    where:  { id: LOG_ID },
    select: { id: true, clientId: true, status: true, checkInSignatureUrl: true, packageCounted: true, sessionDate: true, setLogs: true },
  });
  const approver = await prisma.user.findFirstOrThrow({ where: { email: APPROVER_EMAIL }, select: { id: true, name: true, role: true } });
  console.log("Buổi:", vnDay(log.sessionDate), log.status, "· người duyệt:", approver.name, approver.role);

  if (log.status !== "VOID") throw new Error("Buổi không ở trạng thái huỷ");
  if (!log.checkInSignatureUrl || !log.packageCounted) throw new Error("Khách chưa ký check-in / chưa bị trừ buổi");
  const keys = [1, 2, 3, 4, 5, 6].flatMap((n) => [`set${n}Load`, `set${n}Reps`]);
  const hasData = (log.setLogs as unknown as Record<string, unknown>[])
    .some((s) => keys.some((k) => s[k] != null && String(s[k]).trim() !== ""));
  if (!hasData) throw new Error("Buổi chưa nhập số liệu bài tập");
  const sameDay = await prisma.workoutLog.findMany({
    where:  { clientId: log.clientId, id: { not: log.id }, status: "COMPLETED" },
    select: { sessionDate: true },
  });
  if (sameDay.some((o) => vnDay(o.sessionDate) === vnDay(log.sessionDate))) throw new Error("Ngày này đã có buổi được tính");

  if (!APPLY) {
    console.log("Đủ điều kiện. Chạy thử — thêm --apply để lưu.");
    return;
  }
  await prisma.workoutLog.update({
    where: { id: LOG_ID },
    data:  { status: "COMPLETED", confirmationMethod: "FM_APPROVAL", confirmedAt: new Date(), creditedById: approver.id },
  });
  console.log("Đã tính buổi dạy.");
}

main().finally(() => prisma.$disconnect());
