import { prisma } from "@/lib/prisma";
import { rateForWeight } from "@/lib/weight-timeline";
import { fmsByBranch } from "@/lib/package-progress";
import { sendPushToUsers } from "@/lib/push";

/**
 * Máy chủ chạy giờ UTC, còn khách cân theo giờ Việt Nam: lần cân 6h sáng thứ
 * Hai ở VN là 23h Chủ nhật ở UTC, nhóm theo giờ máy chủ sẽ đẩy nó về tuần
 * trước. Dời sang giờ VN rồi mới chia tuần.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const toVN = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS);

/** Khoá tuần ISO theo giờ VN, vd "2026-W40". */
function getISOWeekKey(date: Date): string {
  const d = toVN(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

/** Khoá tuần ISO của tuần liền trước tuần chứa `date`. */
function prevWeekKey(date: Date): string {
  return getISOWeekKey(new Date(date.getTime() - 7 * 86400000));
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Những giai đoạn của chương trình tập mà khách CÒN đang giảm cân — chỉ những
 * giai đoạn này mới xét chậm tiến độ. Giai đoạn duy trì thì không có chỉ tiêu
 * giảm nên không cảnh báo.
 */
const WEIGHT_LOSS_PHASES = new Set(["Giai đoạn 1", "Giai đoạn 2: Giảm béo"]);

/**
 * CHẬM TIẾN ĐỘ = TUẦN VỪA QUA giảm ít hơn chỉ tiêu.
 *
 *   • Mỗi tuần (thứ Hai → Chủ nhật, giờ VN) lấy TRUNG BÌNH các lần cân, chỉ
 *     tính tuần có ≥3 lần cân — cân một lần thì dao động nước làm sai số.
 *   • So tuần vừa kết thúc với tuần liền trước nó:
 *       % giảm = (TB tuần trước − TB tuần vừa qua) / TB tuần trước
 *   • Chỉ tiêu = rateForWeight(cân nặng tuần vừa qua, chiều cao) — 1% / 0.75% /
 *     0.5% theo mốc chiều cao, cùng một nguồn với tư vấn và thực đơn.
 *
 * Trước đây lấy trung bình MỌI tuần từ đầu lộ trình, nên khách giảm tốt mấy
 * tuần đầu rồi chững lại vẫn "đạt" suốt — đúng lúc cần hỗ trợ thì không ai được
 * báo. Tuần đang chạy dở không xét: chưa hết tuần thì chưa kết luận được.
 * Thiếu một trong hai tuần đủ 3 lần cân thì bỏ qua (đã có NO_WEIGH_IN lo).
 */
export function checkClientProgress(
  weightLogs: { date: Date; weight: number }[],
  phase: string,
  height: number,
  now: Date
): {
  shouldAlert: boolean;
  actualRate: number;
  expectedRate: number;
  lastWeekAvg: number;
  prevWeekAvg: number;
} | null {
  if (!WEIGHT_LOSS_PHASES.has(phase)) return null;

  const lastWeek = prevWeekKey(now);
  const weekBefore = prevWeekKey(new Date(now.getTime() - 7 * 86400000));

  const byWeek = new Map<string, number[]>();
  for (const log of weightLogs) {
    const key = getISOWeekKey(new Date(log.date));
    if (key !== lastWeek && key !== weekBefore) continue;
    const arr = byWeek.get(key) ?? [];
    arr.push(log.weight);
    byWeek.set(key, arr);
  }
  const avgOf = (key: string) => {
    const w = byWeek.get(key);
    return w && w.length >= 3 ? w.reduce((a, b) => a + b, 0) / w.length : null;
  };
  const lastWeekAvg = avgOf(lastWeek);
  const prevWeekAvg = avgOf(weekBefore);
  if (lastWeekAvg == null || prevWeekAvg == null) return null;

  const actualRate = ((prevWeekAvg - lastWeekAvg) / prevWeekAvg) * 100;
  const expectedRate = parseFloat((rateForWeight(lastWeekAvg, height) * 100).toFixed(2));

  return {
    shouldAlert: actualRate < expectedRate,
    actualRate,
    expectedRate,
    lastWeekAvg,
    prevWeekAvg,
  };
}

export async function checkWeeklyProgress() {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    include: {
      branch: { select: { name: true } },
      assignedPT: { select: { name: true } },
      weightLogs: { orderBy: { date: "asc" } },
      workoutPrograms: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  let created = 0;
  let notified = 0;
  // Người nhận thông báo chậm tiến độ: FM của cơ sở + mọi Admin.
  const [branchFMs, admins] = await Promise.all([
    fmsByBranch(),
    prisma.user.findMany({ where: { role: "ADMIN", deletedAt: null }, select: { id: true } }),
  ]);
  const adminIds = admins.map((a) => a.id);
  // Gom lại, cuối lượt mỗi người nhận đúng MỘT push tóm tắt — Admin thấy cả hệ
  // thống, gửi lẻ từng khách thì sáng thứ Hai điện thoại kêu vài chục lần.
  const pushQueue = new Map<string, string[]>();

  for (const client of clients) {
    const ptId = client.assignedPTId;

    const existingAlerts = await prisma.performanceAlert.findMany({
      where: { clientId: client.id, weekStart },
    });
    const existingTypes = new Set(existingAlerts.map((a) => a.alertType));

    // --- NO_WEIGH_IN ---
    if (!existingTypes.has("NO_WEIGH_IN") && client.weightLogs.length > 0) {
      const recentLog = client.weightLogs.find((l) => new Date(l.date) >= sevenDaysAgo);
      if (!recentLog) {
        await prisma.performanceAlert.create({
          data: {
            clientId: client.id,
            ptId,
            alertType: "NO_WEIGH_IN",
            weekStart,
            note: `Khách hàng chưa cân trong 7 ngày qua.`,
          },
        });
        created++;
      }
    }

    // --- SLOW_PROGRESS ---
    if (!existingTypes.has("SLOW_PROGRESS")) {
      const activeProgram = client.workoutPrograms[0];
      if (activeProgram) {
        const result = checkClientProgress(
          client.weightLogs.map((l) => ({ date: l.date, weight: l.weight })),
          activeProgram.phase,
          client.height,
          now
        );

        if (result?.shouldAlert) {
          const note =
            `Tuần qua giảm ${result.actualRate.toFixed(2)}% ` +
            `(TB ${result.prevWeekAvg.toFixed(1)} → ${result.lastWeekAvg.toFixed(1)} kg), ` +
            `chỉ tiêu ≥${result.expectedRate}%/tuần.`;

          const alert = await prisma.performanceAlert.create({
            data: {
              clientId: client.id,
              ptId,
              alertType: "SLOW_PROGRESS",
              weekStart,
              expectedRate: result.expectedRate,
              actualRate: result.actualRate,
              weeksAnalyzed: 2,
              note,
            },
          });

          const recipients = Array.from(new Set([...(branchFMs.get(client.branchId) ?? []), ...adminIds]));
          const message =
            `${client.fullName} (${client.branch?.name ?? "—"} · PT ${client.assignedPT?.name ?? "—"}) ` +
            `chậm tiến độ giảm cân: ${note}`;
          if (recipients.length > 0) {
            await prisma.slowProgressNotification.createMany({
              data: recipients.map((userId) => ({ userId, clientId: client.id, alertId: alert.id, message })),
              skipDuplicates: true,
            });
            for (const id of recipients) {
              const list = pushQueue.get(id) ?? [];
              list.push(client.fullName);
              pushQueue.set(id, list);
            }
            notified++;
          }
          created++;
        }
      }
    }
  }

  for (const [userId, names] of Array.from(pushQueue.entries())) {
    const head = names.slice(0, 3).join(", ");
    await sendPushToUsers([userId], {
      title: `${names.length} khách chậm tiến độ giảm cân tuần qua`,
      body: names.length > 3 ? `${head} và ${names.length - 3} khách khác` : head,
      url: "/dashboard",
      tag: `slow-progress-${weekStart.toISOString().slice(0, 10)}`,
    }).catch(() => 0);
  }

  return { checked: clients.length, created, notified };
}
