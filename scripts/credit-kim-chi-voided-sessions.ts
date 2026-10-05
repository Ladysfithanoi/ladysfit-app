/**
 * Đổi phần "+5 buổi" chỉnh tay tháng 9/2026 của khách Lê Kim Chi (lộ trình L2)
 * sang "Tính buổi dạy" (FM_APPROVAL) trên chính 5 buổi bị huỷ.
 *
 * Bối cảnh: PT Đỗ Quỳnh Anh quên chụp ảnh check-out ở 5 buổi 28/07, 07/08, 18/08,
 * 05/09, 08/09 — buổi tự huỷ (VOID) nhưng khách đã ký check-in và đã bị trừ buổi.
 * Ngày 11/09 FM Nguyễn Thị Phương Thảo bù bằng một dòng chỉnh tay +5 dồn hết vào
 * tháng 9, nên bảng lương tháng 9 hiện 22 show (17 thật + 5) và phiếu check-in chỉ
 * in 53/58 buổi khách đã dùng.
 *
 * Sau khi chạy: dòng +5 bị xoá; 5 buổi thành COMPLETED/FM_APPROVAL, ghi công cho
 * Quỳnh Anh ĐÚNG THÁNG đã dạy (07: 1, 08: 2, 09: 2 → tháng 9 còn 19 show), và in
 * lên phiếu check-in (58/58). Người duyệt ghi là FM đã tạo dòng +5. Kiểm tra đúng
 * các rào của POST /api/clients/[id]/workout-logs/[sessionId]/credit: buổi VOID,
 * có chữ ký check-in, đã trừ buổi, có số liệu bài tập, không trùng ngày.
 *
 * Chạy: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/credit-kim-chi-voided-sessions.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const CLIENT_ID     = "cmrnbe9nd0002e13oex3cc0tq";
const ADJUSTMENT_ID = "cmtwnojwk0001opluaz89on0t";
const FM_ID         = "cmp2c5jsr0005y4mazhcyeqpb"; // Nguyễn Thị Phương Thảo — người tạo dòng +5
const LOG_IDS = [
  "cms416kb9000n7bguuv353fw4", // 28/07
  "cmsis5d7q000c5juz97hdq6qy", // 07/08
  "cmsygcey90001ty708gjwsi5g", // 18/08
  "cmto6zeod000113pv92kqk25p", // 05/09
  "cmtryjag90001vvz5rht76vm3", // 08/09
];

const vnDay = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);

function hasAnySetData(sets: Record<string, unknown>[]): boolean {
  const keys = [1, 2, 3, 4, 5, 6].flatMap((n) => [`set${n}Load`, `set${n}Reps`]);
  return sets.some((s) => keys.some((k) => s[k] != null && String(s[k]).trim() !== ""));
}

async function main() {
  const adj = await prisma.pTSessionAdjustment.findUnique({ where: { id: ADJUSTMENT_ID } });
  console.log("Dòng chỉnh tay:", adj ? `${adj.month}/${adj.year} delta ${adj.delta}` : "(đã xoá)");

  let ok = true;
  for (const id of LOG_IDS) {
    const log = await prisma.workoutLog.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, clientId: true, status: true, checkInSignatureUrl: true,
        packageCounted: true, sessionDate: true, setLogs: true,
      },
    });
    const nearby = await prisma.workoutLog.findMany({
      where: {
        clientId: CLIENT_ID, id: { not: id }, status: "COMPLETED",
        sessionDate: {
          gte: new Date(log.sessionDate.getTime() - 36 * 3600_000),
          lte: new Date(log.sessionDate.getTime() + 36 * 3600_000),
        },
      },
      select: { sessionDate: true },
    });
    const sameDay = nearby.filter((o) => vnDay(o.sessionDate) === vnDay(log.sessionDate)).length;

    const problems = [
      log.clientId !== CLIENT_ID && "không phải khách Kim Chi",
      log.status !== "VOID" && `status ${log.status}`,
      !log.checkInSignatureUrl && "không có chữ ký check-in",
      !log.packageCounted && "chưa trừ buổi",
      !hasAnySetData(log.setLogs as unknown as Record<string, unknown>[]) && "không có số liệu bài tập",
      sameDay > 0 && "trùng ngày với buổi đã tính",
    ].filter(Boolean);
    console.log(vnDay(log.sessionDate), id, problems.length ? `✗ ${problems.join(", ")}` : "✓");
    if (problems.length) ok = false;
  }

  if (!ok) { console.log("Có buổi không đạt điều kiện — dừng."); return; }
  if (!APPLY) { console.log("Chạy thử. Thêm --apply để ghi."); return; }

  await prisma.$transaction([
    ...LOG_IDS.map((id) => prisma.workoutLog.update({
      where: { id },
      data: { status: "COMPLETED", confirmationMethod: "FM_APPROVAL", confirmedAt: new Date(), creditedById: FM_ID },
    })),
    ...(adj ? [prisma.pTSessionAdjustment.delete({ where: { id: ADJUSTMENT_ID } })] : []),
  ]);
  console.log("Đã ghi.");
}

main().finally(() => prisma.$disconnect());
