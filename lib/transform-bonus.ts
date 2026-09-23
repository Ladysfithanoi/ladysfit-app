import { prisma } from "@/lib/prisma";
import { ptInChargeAt } from "@/lib/transform-credit";

// ── Thưởng transform theo hợp đồng ───────────────────────────────────────────
// HAI KHÁI NIỆM TÁCH BẠCH, đừng gộp:
//
//   • ĐẾM transform cho PT (xếp hạng, thăng cấp): khách giảm đủ 7 kg so với cân
//     đầu tiên — một khách một lần. Xem lib/transform-credit.ts.
//   • THƯỞNG transform trên bảng lương (file này): 100.000đ cho mỗi HỢP ĐỒNG mà
//     khách đạt cam kết giảm cân của chính hợp đồng đó:
//        L1 — giảm từ 2 kg      L2 — giảm từ 5 kg
//        L3, L4 — giảm đủ "Mục tiêu giảm (kg)" nhập ở phần chỉnh sửa lộ trình
//
// Mốc giảm đo từ lần cân gần nhất tính đến NGÀY BẮT ĐẦU lộ trình (không có thì
// lấy cân đầu tiên của khách), và phải đạt trong thời hạn lộ trình. Thưởng vào
// lương THÁNG khách đạt mốc, cho người đang phụ trách khách vào ngày đó. Mỗi
// hợp đồng thưởng đúng một lần. KOC/KOL có hoa hồng riêng nên không tính ở đây.

export const TRANSFORM_BONUS_AMOUNT = 100_000;

/** Ngưỡng giảm cố định theo gói. L3/L4 lấy từ mục tiêu của từng lộ trình. */
const FIXED_GOAL_KG: Record<string, number> = { L1: 2, L2: 5 };
const CUSTOM_GOAL_PACKAGES = ["L3", "L4"];

const DAY_MS = 86_400_000;
/** Sai số làm tròn — 80,0 − 78,0 trong số thực có thể ra 1,9999999. */
const EPS = 0.01;

export type TransformBonus = {
  enrollmentId: string;
  clientId: string;
  clientName: string;
  packageName: string;
  ptId: string;
  /** Ngày cân đạt mốc — quyết định thưởng vào lương tháng nào. */
  date: Date;
  goalKg: number;
  lostKg: number;
};

/** Mục tiêu giảm (kg) của một lộ trình; null = gói này không có thưởng transform. */
export function transformGoalKg(packageName: string, goalLossKg: number | null): number | null {
  if (packageName in FIXED_GOAL_KG) return FIXED_GOAL_KG[packageName];
  if (CUSTOM_GOAL_PACKAGES.includes(packageName)) return goalLossKg && goalLossKg > 0 ? goalLossKg : null;
  return null;
}

/** Mọi hợp đồng đạt mốc thưởng trong [start, end). */
export async function computeTransformBonuses(range: { start: Date; end: Date }): Promise<TransformBonus[]> {
  const enrollments = await prisma.packageEnrollment.findMany({
    where: {
      packageName: { in: [...Object.keys(FIXED_GOAL_KG), ...CUSTOM_GOAL_PACKAGES] },
      contractType: { in: ["NORMAL", "TRANSFER"] },
      startDate: { not: null, lt: range.end },
      OR: [{ endDate: null }, { endDate: { gte: new Date(range.start.getTime() - DAY_MS) } }],
    },
    select: {
      id: true, clientId: true, packageName: true, goalLossKg: true, startDate: true, endDate: true,
      client: { select: { fullName: true, assignedPTId: true, initialWeight: true, createdAt: true } },
    },
  });
  const eligible = enrollments.filter((e) => transformGoalKg(e.packageName, e.goalLossKg) != null);
  if (eligible.length === 0) return [];

  const clientIds = Array.from(new Set(eligible.map((e) => e.clientId)));
  const [logs, assignments] = await Promise.all([
    prisma.weightLog.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, date: true, weight: true },
      orderBy: { date: "asc" },
    }),
    prisma.clientPTAssignment.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, ptId: true, startedAt: true },
      orderBy: { startedAt: "asc" },
    }),
  ]);

  const logsByClient = groupBy(logs, (l) => l.clientId);
  const segmentsByClient = groupBy(assignments, (a) => a.clientId);

  const bonuses: TransformBonus[] = [];
  for (const e of eligible) {
    const goalKg = transformGoalKg(e.packageName, e.goalLossKg)!;
    const clientLogs = logsByClient.get(e.clientId) ?? [];
    // Cân ngày bắt đầu (cân buổi đầu tiên) vẫn là mốc gốc, nên tính tới hết ngày đó.
    const baselineCutoff = e.startDate!.getTime() + DAY_MS;
    const windowEnd = e.endDate ? e.endDate.getTime() + DAY_MS : Infinity;

    let baseline = e.client.initialWeight;
    let hit: { date: Date; weight: number } | null = null;
    for (const log of clientLogs) {
      const t = log.date.getTime();
      if (t < baselineCutoff) { baseline = log.weight; continue; }
      if (t >= windowEnd) break;
      if (baseline - log.weight >= goalKg - EPS) { hit = log; break; }
    }
    if (!hit || hit.date < range.start || hit.date >= range.end) continue;

    const ptId = ptInChargeAt(
      { id: e.clientId, assignedPTId: e.client.assignedPTId, createdAt: e.client.createdAt },
      (segmentsByClient.get(e.clientId) ?? []).map((a) => ({ ptId: a.ptId, startedAt: a.startedAt })),
      hit.date,
    );
    bonuses.push({
      enrollmentId: e.id,
      clientId: e.clientId,
      clientName: e.client.fullName,
      packageName: e.packageName,
      ptId,
      date: hit.date,
      goalKg,
      lostKg: Math.round((baseline - hit.weight) * 10) / 10,
    });
  }
  return bonuses;
}

/** Thưởng transform của một người trong một tháng lương. */
export async function transformBonusForUser(
  userId: string,
  month: number,
  year: number,
): Promise<{ goalBonus: number; clientsAchievedGoal: number; items: TransformBonus[] }> {
  const all = await computeTransformBonuses({
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1),
  });
  const items = all.filter((b) => b.ptId === userId);
  return {
    goalBonus: items.length * TRANSFORM_BONUS_AMOUNT,
    clientsAchievedGoal: items.length,
    items,
  };
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}
