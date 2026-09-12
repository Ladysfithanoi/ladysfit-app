/**
 * Trả các buổi tập từ 28/07/2026 của khách Lò Quế Hằng về đúng gói Loyalfit.
 *
 * Bối cảnh: gói L2 của khách không có ngày bắt đầu — mà gói không ngày thì cũng
 * không có ngày hết hạn, tức là không bao giờ tự đóng. Nó nằm lại mãi ở đầu hàng
 * "gói cũ nhất còn trừ được buổi", nên mọi buổi khách tập vẫn bị trừ vào L2 kể cả
 * sau khi khách đã mua lộ trình Loyalfit mới ngày 28/07/2026. Kết quả: L2 chạy
 * tiếp tới 30/60 trong khi Loyalfit mới đứng nguyên 0/36.
 *
 * Luật đã được vá ở lib/checkin-eligibility.ts (gói chưa có ngày bắt đầu thì
 * không trừ được buổi) nên từ nay không còn buổi nào rơi nhầm nữa. Script này
 * dọn nốt phần đã lỡ ghi sai trước đó.
 *
 * LÀM GÌ — chỉ đúng hai việc, không đụng tới bản thân buổi tập:
 *   1. workout_logs."packageEnrollmentId": L2 → Loyalfit, cho các buổi từ ngày
 *      Loyalfit bắt đầu trở đi. Cột này quyết định buổi hiện trên phiếu check-in
 *      của lộ trình nào và bảng lương tra đơn giá theo gói nào.
 *   2. "sessionsUsed" của hai gói: chuyển đúng số buổi ĐÃ TRỪ (packageCounted)
 *      từ L2 sang Loyalfit. Cộng/trừ theo đúng số buổi động vào, KHÔNG đếm lại
 *      từ đầu — đếm lại sẽ xoá mất phần Admin/FM từng chỉnh tay.
 *
 * Đơn giá buổi dạy KHÔNG đổi: L2 và Loyalfit cùng một bậc 60.000đ/buổi
 * (SESSION_PAY_L1_L2_LOYAL ở lib/packages.ts), nên lương PT giữ nguyên.
 *
 * Chạy:
 *   npx tsx --env-file=.env scripts/move-hang-sessions-to-loyalfit.ts           # chỉ xem
 *   npx tsx --env-file=.env scripts/move-hang-sessions-to-loyalfit.ts --apply   # thực thi
 *
 * Chạy lại lần hai là không còn buổi nào khớp điều kiện → không làm gì thêm.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

/** Gói L2 không ngày — nơi các buổi đang bị trừ nhầm. */
const FROM_ID = "97a6b045-b915-40c6-ad06-61f6b7fbe375";
/** Gói Loyalfit mua ngày 28/07/2026 — nơi các buổi lẽ ra phải nằm. */
const TO_ID = "e030474c-ee48-4cb9-81ec-7bb99ddde65a";

const day = (d: Date) => d.toISOString().slice(0, 10);
const apply = process.argv.includes("--apply");

async function main() {
  const [from, to] = await Promise.all([
    prisma.packageEnrollment.findUnique({ where: { id: FROM_ID } }),
    prisma.packageEnrollment.findUnique({ where: { id: TO_ID } }),
  ]);
  if (!from || !to) throw new Error("Không tìm thấy một trong hai lộ trình");
  if (from.clientId !== to.clientId) throw new Error("Hai lộ trình không cùng một khách");
  if (to.startDate == null) throw new Error("Lộ trình đích chưa có ngày bắt đầu");

  const client = await prisma.client.findUniqueOrThrow({
    where: { id: to.clientId },
    select: { fullName: true },
  });

  // Mốc cắt là chính ngày Loyalfit bắt đầu: từ ngày đó trở đi khách đã có lộ
  // trình mới, nên buổi thuộc về nó. Buổi trước đó vẫn là buổi của L2 thật.
  const since = to.startDate;

  const logs = await prisma.workoutLog.findMany({
    where: { packageEnrollmentId: FROM_ID, sessionDate: { gte: since } },
    orderBy: { sessionDate: "asc" },
    select: { id: true, sessionDate: true, status: true, packageCounted: true },
  });

  console.log(`Khách: ${client.fullName}`);
  console.log(`  từ : ${from.packageName} — ${from.sessionsUsed}/${from.sessions}`);
  console.log(`  sang: ${to.packageName} — ${to.sessionsUsed}/${to.sessions} (bắt đầu ${day(since)})`);
  console.log(`  buổi từ ${day(since)} đang gắn vào ${from.packageName}: ${logs.length}`);

  if (logs.length === 0) {
    console.log("Không có gì để chuyển.");
    return;
  }

  for (const l of logs) {
    console.log(`    ${day(l.sessionDate)}  ${l.status.padEnd(16)} ${l.packageCounted ? "đã trừ buổi" : "chưa trừ buổi"}`);
  }

  // Chỉ những buổi ĐÃ TRỪ mới làm đổi sessionsUsed của hai gói.
  const counted = logs.filter((l) => l.packageCounted).length;
  const nextFrom = Math.max(0, from.sessionsUsed - counted);
  const nextTo = to.sessionsUsed + counted;

  console.log(`\n  → ${from.packageName}: ${from.sessionsUsed}/${from.sessions} thành ${nextFrom}/${from.sessions}`);
  console.log(`  → ${to.packageName}: ${to.sessionsUsed}/${to.sessions} thành ${nextTo}/${to.sessions}`);

  if (nextTo > to.sessions) {
    throw new Error(`Chuyển sang sẽ vượt số buổi của gói đích (${nextTo}/${to.sessions}) — dừng lại`);
  }

  if (!apply) {
    console.log("\n(chỉ xem — thêm --apply để thực thi)");
    return;
  }

  await prisma.$transaction([
    prisma.workoutLog.updateMany({
      where: { id: { in: logs.map((l) => l.id) } },
      data: { packageEnrollmentId: TO_ID },
    }),
    prisma.packageEnrollment.update({
      where: { id: FROM_ID },
      data: { sessionsUsed: nextFrom },
    }),
    prisma.packageEnrollment.update({
      where: { id: TO_ID },
      data: { sessionsUsed: nextTo },
    }),
  ]);

  console.log("\nĐã chuyển xong.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
