import { prisma } from "@/lib/prisma";
import { rateForWeight } from "@/lib/weight-timeline";

function getISOWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
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

async function checkClientProgress(
  clientId: string,
  weightLogs: { date: Date; weight: number }[],
  phase: string,
  height: number
): Promise<{
  shouldAlert: boolean;
  avgRate: number;
  expectedRate: number;
  weeksAnalyzed: number;
} | null> {
  if (!WEIGHT_LOSS_PHASES.has(phase)) return null;

  // Group weight logs by ISO week
  const weeklyData = new Map<string, number[]>();
  for (const log of weightLogs) {
    const weekKey = getISOWeekKey(new Date(log.date));
    if (!weeklyData.has(weekKey)) weeklyData.set(weekKey, []);
    weeklyData.get(weekKey)!.push(log.weight);
  }

  // Only keep weeks with ≥3 logs and calculate averages
  const weeklyAvgs: { week: string; avg: number }[] = [];
  for (const [week, weights] of Array.from(weeklyData.entries())) {
    if (weights.length >= 3) {
      const avg = weights.reduce((a: number, b: number) => a + b, 0) / weights.length;
      weeklyAvgs.push({ week, avg });
    }
  }

  weeklyAvgs.sort((a, b) => a.week.localeCompare(b.week));

  if (weeklyAvgs.length < 2) return null;

  // Calculate consecutive weekly change rates (positive = lost weight)
  const weeklyRates: number[] = [];
  for (let i = 1; i < weeklyAvgs.length; i++) {
    const rate = ((weeklyAvgs[i - 1].avg - weeklyAvgs[i].avg) / weeklyAvgs[i - 1].avg) * 100;
    weeklyRates.push(rate);
  }

  const avgRate = weeklyRates.reduce((a, b) => a + b, 0) / weeklyRates.length;

  // Chỉ tiêu lấy theo cân nặng MỚI NHẤT so với chiều cao, không theo giai đoạn
  // của chương trình: khách càng về gần mốc chuẩn thì đòi hỏi càng nhẹ đi.
  // Quy tắc ở lib/weight-timeline — cùng một nguồn với tư vấn và thực đơn.
  const latestWeight = weeklyAvgs[weeklyAvgs.length - 1].avg;
  const expectedRate = parseFloat((rateForWeight(latestWeight, height) * 100).toFixed(2));

  void clientId;
  return {
    shouldAlert: avgRate < expectedRate,
    avgRate,
    expectedRate,
    weeksAnalyzed: weeklyAvgs.length,
  };
}

export async function checkWeeklyProgress() {
  const weekStart = getWeekStart(new Date());
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    include: {
      weightLogs: { orderBy: { date: "asc" } },
      workoutPrograms: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  let created = 0;

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
        const result = await checkClientProgress(
          client.id,
          client.weightLogs.map((l) => ({ date: l.date, weight: l.weight })),
          activeProgram.phase,
          client.height
        );

        if (result?.shouldAlert) {
          const note =
            `Tốc độ giảm cân trung bình: ${result.avgRate.toFixed(2)}%/tuần ` +
            `(kỳ vọng: ≥${result.expectedRate}%/tuần). ` +
            `Phân tích dựa trên ${result.weeksAnalyzed} tuần có đủ dữ liệu (≥3 lần cân/tuần).`;

          await prisma.performanceAlert.create({
            data: {
              clientId: client.id,
              ptId,
              alertType: "SLOW_PROGRESS",
              weekStart,
              expectedRate: result.expectedRate,
              actualRate: result.avgRate,
              weeksAnalyzed: result.weeksAnalyzed,
              note,
            },
          });
          created++;
        }
      }
    }
  }

  return { checked: clients.length, created };
}
