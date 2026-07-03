import { prisma } from "@/lib/prisma";

// ── Bộ máy xét thăng hạng PT ─────────────────────────────────────────────────
// Một PT ở cấp hiện tại được thăng lên cấp kế tiếp khi đủ CẢ 4 điều kiện:
//   1. Đậu bài kiểm tra lý thuyết (lần thi gần nhất passed)
//   2. Đạt bài kiểm tra thực hành (lần chấm gần nhất passed, còn hạn theo retestIntervalDays)
//   3. TB doanh số/tháng ≥ promoteMinAvgRevenue của cấp hiện tại
//   4. Số khách transform ≥ promoteMinTransform của cấp hiện tại
// Cấp cao nhất (không còn cấp trên) thì giữ nguyên.

export type PromotionCondition = {
  key: "exam" | "practical" | "revenue" | "transform";
  label: string;
  ok: boolean;
  detail: string;
};

export type PromotionEval = {
  ptId: string;
  currentLevelName: string | null;
  nextLevelName: string | null;
  nextLevelId: string | null;
  avgMonthlyRevenue: number; // triệu
  transformedCount: number;
  conditions: PromotionCondition[];
  eligible: boolean;
};

type PtStat = { avgMonthlyRevenue: number; transformedCount: number };

/** Số tháng dùng để tính TB doanh số của năm (loại tháng đang diễn ra). */
function avgMonthsForYear(year: number): number {
  const now = new Date();
  const monthsElapsed =
    year < now.getFullYear() ? 12 : year > now.getFullYear() ? 0 : now.getMonth();
  return Math.max(monthsElapsed, 1);
}

/** TB doanh số/tháng (triệu) + số khách transform cho danh sách PT trong 1 năm. */
export async function computePtStats(
  ptIds: string[],
  year: number
): Promise<Map<string, PtStat>> {
  const stats = new Map<string, PtStat>();
  if (ptIds.length === 0) return stats;

  const months = avgMonthsForYear(year);

  const [leads, clients] = await Promise.all([
    prisma.salesLead.findMany({
      where: { assignedPTId: { in: ptIds }, year, month: { lte: months } },
      select: { assignedPTId: true, actualRevenue: true },
    }),
    prisma.client.findMany({
      where: { assignedPTId: { in: ptIds }, hasTransformed: true },
      select: { assignedPTId: true },
    }),
  ]);

  const revenueByPt = new Map<string, number>();
  for (const l of leads) {
    if (!l.assignedPTId) continue;
    revenueByPt.set(l.assignedPTId, (revenueByPt.get(l.assignedPTId) ?? 0) + (l.actualRevenue ?? 0));
  }
  const transformByPt = new Map<string, number>();
  for (const c of clients) {
    if (!c.assignedPTId) continue;
    transformByPt.set(c.assignedPTId, (transformByPt.get(c.assignedPTId) ?? 0) + 1);
  }

  for (const id of ptIds) {
    stats.set(id, {
      avgMonthlyRevenue: (revenueByPt.get(id) ?? 0) / months,
      transformedCount: transformByPt.get(id) ?? 0,
    });
  }
  return stats;
}

type UserForEval = {
  id: string;
  ptLevel: {
    order: number;
    retestIntervalDays: number;
    promoteMinAvgRevenue: number;
    promoteMinTransform: number;
  } | null;
};

type ActiveLevel = { id: string; name: string; order: number };

/** Đánh giá điều kiện thăng hạng cho 1 PT (không ghi DB). */
export async function evaluatePt(
  user: UserForEval,
  levels: ActiveLevel[],
  stat: PtStat
): Promise<PromotionEval> {
  const currentOrder = user.ptLevel?.order ?? -1;
  const current = levels.find((l) => l.order === currentOrder) ?? null;
  const next = levels
    .filter((l) => l.order > currentOrder)
    .sort((a, b) => a.order - b.order)[0] ?? null;

  const minRevenue = user.ptLevel?.promoteMinAvgRevenue ?? 0;
  const minTransform = user.ptLevel?.promoteMinTransform ?? 0;
  const retestDays = user.ptLevel?.retestIntervalDays ?? 30;

  // Điều kiện 1: lý thuyết — lần thi gần nhất đậu
  const lastExam = await prisma.examAttempt.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { passed: true },
  });
  const examOk = lastExam?.passed === true;

  // Điều kiện 2: thực hành — lần chấm gần nhất đậu và còn hạn
  const lastPractical = await prisma.practicalAssessment.findFirst({
    where: { ptId: user.id },
    orderBy: { createdAt: "desc" },
    select: { passed: true, createdAt: true },
  });
  const practicalFresh =
    !!lastPractical &&
    Date.now() - lastPractical.createdAt.getTime() <= retestDays * 24 * 60 * 60 * 1000;
  const practicalOk = lastPractical?.passed === true && practicalFresh;

  // Điều kiện 3 & 4: doanh số + transform
  const revenueOk = stat.avgMonthlyRevenue >= minRevenue;
  const transformOk = stat.transformedCount >= minTransform;

  const conditions: PromotionCondition[] = [
    {
      key: "exam",
      label: "Lý thuyết",
      ok: examOk,
      detail: examOk ? "Đã đậu" : lastExam ? "Lần gần nhất chưa đạt" : "Chưa thi",
    },
    {
      key: "practical",
      label: "Thực hành",
      ok: practicalOk,
      detail: !lastPractical
        ? "Chưa chấm"
        : !lastPractical.passed
          ? "Lần gần nhất chưa đạt"
          : !practicalFresh
            ? "Đã quá hạn, cần chấm lại"
            : "Đã đạt",
    },
    {
      key: "revenue",
      label: "Doanh số",
      ok: revenueOk,
      detail: `TB ${stat.avgMonthlyRevenue.toFixed(1)} / cần ≥ ${minRevenue} tr`,
    },
    {
      key: "transform",
      label: "Transform",
      ok: transformOk,
      detail: `${stat.transformedCount} / cần ≥ ${minTransform}`,
    },
  ];

  const eligible = !!next && conditions.every((c) => c.ok);

  return {
    ptId: user.id,
    currentLevelName: current?.name ?? null,
    nextLevelName: next?.name ?? null,
    nextLevelId: next?.id ?? null,
    avgMonthlyRevenue: stat.avgMonthlyRevenue,
    transformedCount: stat.transformedCount,
    conditions,
    eligible,
  };
}

/** Lấy các cấp độ đang bật, sắp theo order tăng dần. */
export async function getActiveLevels(): Promise<ActiveLevel[]> {
  return prisma.pTLevel.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: { id: true, name: true, order: true },
  });
}

/** Đánh giá 1 PT theo id (tải sẵn dữ liệu cần thiết). */
export async function evaluatePtById(ptId: string, year = new Date().getFullYear()): Promise<PromotionEval | null> {
  const sys = await prisma.systemConfig.findUnique({ where: { id: "main" } });
  if (sys?.enableLevelSystem === false) return null;

  const user = await prisma.user.findUnique({
    where: { id: ptId },
    select: {
      id: true,
      role: true,
      ptLevel: {
        select: { order: true, retestIntervalDays: true, promoteMinAvgRevenue: true, promoteMinTransform: true },
      },
    },
  });
  if (!user || user.role !== "PT") return null;

  const [levels, stats] = await Promise.all([getActiveLevels(), computePtStats([ptId], year)]);
  const stat = stats.get(ptId) ?? { avgMonthlyRevenue: 0, transformedCount: 0 };
  return evaluatePt(user, levels, stat);
}

/**
 * Xét & thăng hạng cho 1 PT nếu đủ điều kiện. Trả về true nếu vừa thăng.
 * Dùng ở các điểm chạm (đậu lý thuyết, chấm thực hành xong).
 */
export async function tryPromotePt(ptId: string): Promise<boolean> {
  const evalResult = await evaluatePtById(ptId);
  if (!evalResult || !evalResult.eligible || !evalResult.nextLevelId) return false;

  await prisma.user.update({ where: { id: ptId }, data: { ptLevelId: evalResult.nextLevelId } });
  const u = await prisma.user.findUnique({ where: { id: ptId }, select: { name: true, email: true } });
  await prisma.upgradeNotification.create({
    data: { userId: ptId, userName: u?.name ?? u?.email ?? "PT", passed: true },
  });
  return true;
}

/** Cron: quét toàn bộ PT, tự thăng hạng ai đủ điều kiện. Trả về danh sách đã thăng. */
export async function runAutoPromotion(): Promise<{ promoted: { ptId: string; to: string }[] }> {
  const sys = await prisma.systemConfig.findUnique({ where: { id: "main" } });
  if (sys?.enableLevelSystem === false) return { promoted: [] };

  const [users, levels] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PT", deletedAt: null },
      select: {
        id: true,
        role: true,
        name: true,
        email: true,
        ptLevel: {
          select: { order: true, retestIntervalDays: true, promoteMinAvgRevenue: true, promoteMinTransform: true },
        },
      },
    }),
    getActiveLevels(),
  ]);

  const year = new Date().getFullYear();
  const stats = await computePtStats(users.map((u) => u.id), year);

  const promoted: { ptId: string; to: string }[] = [];
  for (const u of users) {
    const stat = stats.get(u.id) ?? { avgMonthlyRevenue: 0, transformedCount: 0 };
    const ev = await evaluatePt(u, levels, stat);
    if (ev.eligible && ev.nextLevelId) {
      await prisma.user.update({ where: { id: u.id }, data: { ptLevelId: ev.nextLevelId } });
      await prisma.upgradeNotification.create({
        data: { userId: u.id, userName: u.name ?? u.email ?? "PT", passed: true },
      });
      promoted.push({ ptId: u.id, to: ev.nextLevelName ?? "" });
    }
  }
  return { promoted };
}
