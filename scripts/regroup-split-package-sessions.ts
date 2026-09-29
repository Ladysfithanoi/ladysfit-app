/**
 * Gom các buổi tập bị trừ rải rác sang nhiều gói về đúng MỘT gói theo luật mới.
 *
 * Bối cảnh: luật cũ trừ "gói tạo sớm nhất" (createdAt). Khách mua nhiều gói cùng
 * lúc thì các gói có createdAt trùng nhau, database trả về thứ tự hên xui, nên
 * buổi tập của một khách bị rải qua lại giữa L2, L3, L4, Loyalfit… Luật mới ở
 * pickChargeablePackage (lib/checkin-eligibility.ts): L1/L2 → L3/L4 →
 * L5/Loyalfit, cùng bậc thì gói bắt đầu sớm hơn trừ trước.
 *
 * Với mỗi buổi ĐÃ TRỪ (packageCounted) của khách có từ 2 gói trở lên, script xét
 * các gói đang chạy VÀO NGÀY TẬP (đã bắt đầu, chưa hết hạn) và chọn gói theo
 * đúng luật trên. Buổi đang nằm ở gói khác thì chuyển về gói đó.
 *
 * LÀM GÌ — chỉ đúng hai việc, không đụng tới bản thân buổi tập:
 *   1. workout_logs."packageEnrollmentId" → gói đúng.
 *   2. "sessionsUsed" của các gói: cộng/trừ đúng số buổi chuyển đi/đến, KHÔNG
 *      đếm lại từ đầu — đếm lại sẽ xoá mất phần Admin/FM từng chỉnh tay.
 *
 * Khách nào mà chuyển xong có gói bị âm buổi hoặc vượt tổng buổi (số buổi đã bị
 * Admin/FM sửa tay, lệch với nhật ký) thì BỎ QUA và in ra để xem tay.
 *
 * Chạy:
 *   npx tsx --env-file=.env scripts/regroup-split-package-sessions.ts           # chỉ xem
 *   npx tsx --env-file=.env scripts/regroup-split-package-sessions.ts --apply   # thực thi
 *
 * Chạy lại lần hai: mọi buổi đã nằm đúng gói → không làm gì thêm.
 */
import { PrismaClient } from "@prisma/client";
import { chargePriority } from "../lib/checkin-eligibility";

const prisma = new PrismaClient({ log: ["error"] });
const apply = process.argv.includes("--apply");
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");

async function main() {
  const all = await prisma.packageEnrollment.findMany({ orderBy: { createdAt: "asc" } });
  const byClient = new Map<string, typeof all>();
  for (const p of all) byClient.set(p.clientId, [...(byClient.get(p.clientId) ?? []), p]);

  let movedTotal = 0;
  const skipped: string[] = [];
  const noStart = new Set<string>();

  for (const [clientId, pkgs] of Array.from(byClient.entries())) {
    if (pkgs.length < 2) continue;
    const ids = new Set(pkgs.map((p) => p.id));
    const logs = await prisma.workoutLog.findMany({
      where: { clientId, packageCounted: true, packageEnrollmentId: { not: null } },
      select: { id: true, sessionDate: true, packageEnrollmentId: true },
      orderBy: { sessionDate: "asc" },
    });

    // Chỗ trống còn lại của từng gói, cập nhật theo từng buổi chuyển — không bao
    // giờ đẩy một gói vượt quá tổng số buổi của nó.
    const room = new Map(pkgs.map((p) => [p.id, p.sessions - p.sessionsUsed]));
    const isRunning = (p: (typeof pkgs)[number], at: Date) =>
      p.startDate != null && p.startDate <= at && (p.endDate == null || p.endDate >= at);

    const moves: { logId: string; date: Date; from: string; to: string }[] = [];
    for (const l of logs) {
      const cur = l.packageEnrollmentId!;
      const curPkg = pkgs.find((p) => p.id === cur);
      if (!curPkg) continue; // trỏ vào gói đã xoá — không thuộc phạm vi script
      // Chỉ gỡ đúng lỗi "trừ nhầm giữa các gói CÙNG ĐANG CHẠY". Buổi nằm ở gói
      // chưa có ngày bắt đầu / ngoài hạn là chuyện khác — in ra để xem tay.
      // Gói tên lạ (không phải L0–L5/Loyalfit/…) nằm ngoài luật — không động vào.
      if (chargePriority(curPkg.packageName) === 99) continue;
      if (!isRunning(curPkg, l.sessionDate)) {
        if (curPkg.startDate == null) noStart.add(clientId);
        continue;
      }
      const running = pkgs.filter(
        (p) =>
          isRunning(p, l.sessionDate) &&
          chargePriority(p.packageName) !== 99 &&
          (p.id === cur || (room.get(p.id) ?? 0) > 0)
      );
      const key = (p: (typeof pkgs)[number]) => [chargePriority(p.packageName), p.startDate!.getTime()];
      const [bt, bs] = running.map(key).reduce((a, b) => (b[0] < a[0] || (b[0] === a[0] && b[1] < a[1]) ? b : a));
      const tied = running.filter((p) => key(p)[0] === bt && key(p)[1] === bs);
      // Hoà thì giữ nguyên gói đang trừ nếu nó nằm trong nhóm hoà — không chuyển vô cớ.
      if (tied.some((p) => p.id === cur)) continue;
      const to = tied[0].id;
      moves.push({ logId: l.id, date: l.sessionDate, from: cur, to });
      room.set(to, room.get(to)! - 1);
      room.set(cur, room.get(cur)! + 1);
    }
    if (moves.length === 0) continue;

    const delta = new Map<string, number>();
    for (const m of moves) {
      delta.set(m.from, (delta.get(m.from) ?? 0) - 1);
      delta.set(m.to, (delta.get(m.to) ?? 0) + 1);
    }

    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { fullName: true } });
    const name = new Map(pkgs.map((p) => [p.id, `${p.packageName} (bắt đầu ${day(p.startDate)})`]));
    console.log(`\n== ${client?.fullName} — ${moves.length} buổi cần chuyển`);
    for (const m of moves) console.log(`    ${day(m.date)}  ${name.get(m.from)} → ${name.get(m.to)}`);

    let bad = false;
    const updates: { id: string; sessionsUsed: number; status?: "ACTIVE" | "COMPLETED" }[] = [];
    for (const p of pkgs) {
      const dlt = delta.get(p.id) ?? 0;
      if (dlt === 0) continue;
      const next = p.sessionsUsed + dlt;
      console.log(`  → ${name.get(p.id)}: ${p.sessionsUsed}/${p.sessions} thành ${next}/${p.sessions}`);
      if (next < 0 || next > p.sessions) bad = true;
      // Chỉ lật cờ giữa ACTIVE ↔ COMPLETED theo số buổi; EXPIRED/PAUSED giữ nguyên.
      let status: "ACTIVE" | "COMPLETED" | undefined;
      if (p.status === "ACTIVE" && next >= p.sessions) status = "COMPLETED";
      if (p.status === "COMPLETED" && next < p.sessions) status = "ACTIVE";
      updates.push({ id: p.id, sessionsUsed: next, ...(status ? { status } : {}) });
    }
    if (bad) {
      console.log("  !! BỎ QUA: số buổi sẽ âm hoặc vượt tổng — cần xem tay");
      skipped.push(client?.fullName ?? clientId);
      continue;
    }

    movedTotal += moves.length;
    if (!apply) continue;

    const byTarget = new Map<string, string[]>();
    for (const m of moves) byTarget.set(m.to, [...(byTarget.get(m.to) ?? []), m.logId]);
    await prisma.$transaction([
      ...Array.from(byTarget.entries()).map(([to, logIds]) =>
        prisma.workoutLog.updateMany({ where: { id: { in: logIds } }, data: { packageEnrollmentId: to } })
      ),
      ...updates.map((u) =>
        prisma.packageEnrollment.update({
          where: { id: u.id },
          data: { sessionsUsed: u.sessionsUsed, ...(u.status ? { status: u.status } : {}) },
        })
      ),
    ]);
  }

  console.log(`\nTổng buổi chuyển: ${movedTotal}${apply ? " (đã ghi)" : " (chỉ xem — thêm --apply để thực thi)"}`);
  if (skipped.length) console.log(`Bỏ qua, cần xem tay: ${skipped.join(", ")}`);
  if (noStart.size) {
    const names = await prisma.client.findMany({
      where: { id: { in: Array.from(noStart) } },
      select: { fullName: true },
    });
    console.log(`Có buổi trừ vào gói CHƯA CÓ ngày bắt đầu (không tự chuyển): ${names.map((c) => c.fullName.trim()).join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
