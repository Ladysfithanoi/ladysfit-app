import { prisma } from "@/lib/prisma";

/**
 * Thông báo tiến độ lộ trình gửi cho FM.
 *
 * FM cần biết khách sắp dùng hết lộ trình TRƯỚC KHI nó hết, để kịp tư vấn gia
 * hạn — chứ không phải nhận tin khi khách đã nghỉ. Mỗi lộ trình có hai trục
 * chạy song song, mỗi trục 3 mốc, mỗi mốc chỉ báo MỘT lần:
 *
 *   • Theo SỐ BUỔI  — đã tập 50% → 70% → 90% số buổi của gói.
 *   • Theo NGÀY TẬP — đã tập được 2 tháng → chỉ còn 1 tháng → chỉ còn 2 tuần.
 *
 * Chống trùng và chống dội: mỗi trục chỉ giữ mốc CAO NHẤT đã đạt. Khách nhảy
 * thẳng từ 45% lên 72% (nhập bù nhiều buổi) thì FM nhận đúng một tin "70%",
 * không nhận cả 50% lẫn 70%; và mốc 50% coi như đã qua, sau này không báo lại.
 * Cùng lý do đó, gói ngắn ngày (L0 7–12 ngày) không báo "còn 1 tháng / còn 2
 * tuần" — mốc dài hơn cả gói thì báo cũng vô nghĩa.
 */

export type ProgressMilestone =
  | "SESSIONS_50"
  | "SESSIONS_70"
  | "SESSIONS_90"
  | "DAYS_2_MONTHS"
  | "DAYS_1_MONTH_LEFT"
  | "DAYS_2_WEEKS_LEFT";

export type MilestoneTrack = "SESSIONS" | "DAYS";

type Step = { milestone: ProgressMilestone; rank: number };

/** Mốc theo số buổi — rank tăng dần, chỉ mốc cao nhất đã đạt được gửi đi. */
const SESSION_STEPS: (Step & { ratio: number })[] = [
  { milestone: "SESSIONS_50", rank: 1, ratio: 0.5 },
  { milestone: "SESSIONS_70", rank: 2, ratio: 0.7 },
  { milestone: "SESSIONS_90", rank: 3, ratio: 0.9 },
];

/** Mốc theo ngày tập — "sát hạn" xếp rank cao hơn "đã tập 2 tháng". */
const DAY_RANK: Record<string, number> = {
  DAYS_2_MONTHS: 1,
  DAYS_1_MONTH_LEFT: 2,
  DAYS_2_WEEKS_LEFT: 3,
};

export const TRACK_OF: Record<ProgressMilestone, MilestoneTrack> = {
  SESSIONS_50: "SESSIONS",
  SESSIONS_70: "SESSIONS",
  SESSIONS_90: "SESSIONS",
  DAYS_2_MONTHS: "DAYS",
  DAYS_1_MONTH_LEFT: "DAYS",
  DAYS_2_WEEKS_LEFT: "DAYS",
};

export const RANK_OF: Record<ProgressMilestone, number> = {
  SESSIONS_50: 1,
  SESSIONS_70: 2,
  SESSIONS_90: 3,
  DAYS_2_MONTHS: 1,
  DAYS_1_MONTH_LEFT: 2,
  DAYS_2_WEEKS_LEFT: 3,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Số ngày trọn vẹn từ a đến b (b sau a → dương). */
function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

/** Cộng n tháng theo lịch (31/12 + 2 tháng = 28/02), không phải 30 ngày cứng. */
function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  const day = out.getDate();
  out.setMonth(out.getMonth() + n);
  // Tháng đích ngắn hơn thì setMonth nhảy sang tháng sau — kéo về ngày cuối tháng.
  if (out.getDate() < day) out.setDate(0);
  return out;
}

export function formatDate(d: Date | null): string {
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export type EnrollmentForProgress = {
  packageName: string;
  sessions: number;
  sessionsUsed: number;
  startDate: Date | null;
  endDate: Date | null;
  durationDays: number;
  reservedDays: number;
  extensionDays: number;
};

/** Tổng số ngày của gói — dùng để bỏ qua mốc dài hơn cả lộ trình. */
function totalDays(p: EnrollmentForProgress): number {
  if (p.startDate && p.endDate) return Math.max(0, daysBetween(p.startDate, p.endDate));
  return p.durationDays + p.reservedDays + p.extensionDays;
}

/** Mốc số buổi cao nhất đã đạt; null khi chưa tới mốc nào. */
export function reachedSessionMilestone(
  p: EnrollmentForProgress
): ProgressMilestone | null {
  if (p.sessions <= 0) return null;
  const ratio = p.sessionsUsed / p.sessions;
  let hit: ProgressMilestone | null = null;
  for (const step of SESSION_STEPS) if (ratio >= step.ratio) hit = step.milestone;
  return hit;
}

/** Mốc ngày tập cao nhất đã đạt; null khi chưa tới mốc nào. */
export function reachedDayMilestone(
  p: EnrollmentForProgress,
  now: Date = new Date()
): ProgressMilestone | null {
  const span = totalDays(p);
  const hits: ProgressMilestone[] = [];

  if (p.startDate && span > 60 && now >= addMonths(p.startDate, 2)) {
    hits.push("DAYS_2_MONTHS");
  }
  if (p.endDate && p.endDate >= now) {
    const left = daysBetween(now, p.endDate);
    if (span > 30 && left <= 30) hits.push("DAYS_1_MONTH_LEFT");
    if (span > 14 && left <= 14) hits.push("DAYS_2_WEEKS_LEFT");
  }
  if (hits.length === 0) return null;
  return hits.sort((a, b) => DAY_RANK[b] - DAY_RANK[a])[0];
}

/** Câu thông báo gửi FM — nói rõ khách nào, gói nào, còn bao nhiêu, làm gì tiếp. */
export function buildMessage(
  milestone: ProgressMilestone,
  clientName: string,
  p: EnrollmentForProgress,
  now: Date = new Date()
): string {
  const pkg = p.packageName;
  const pct = p.sessions > 0 ? Math.round((p.sessionsUsed / p.sessions) * 100) : 0;
  const left = p.sessions - p.sessionsUsed;
  const progress = `${p.sessionsUsed}/${p.sessions} buổi (${pct}%)`;
  const daysLeft = p.endDate ? Math.max(0, daysBetween(now, p.endDate)) : null;

  switch (milestone) {
    case "SESSIONS_50":
      return `${clientName} đã tập ${progress} gói ${pkg} — qua nửa lộ trình, còn ${left} buổi.`;
    case "SESSIONS_70":
      return `${clientName} đã tập ${progress} gói ${pkg} — còn ${left} buổi, nên bắt đầu tư vấn gia hạn.`;
    case "SESSIONS_90":
      return `${clientName} đã tập ${progress} gói ${pkg} — chỉ còn ${left} buổi, cần chốt gia hạn ngay.`;
    case "DAYS_2_MONTHS":
      return `${clientName} đã tập được 2 tháng (từ ${formatDate(p.startDate)}) — gói ${pkg}, hạn đến ${formatDate(p.endDate)}, đã tập ${progress}.`;
    case "DAYS_1_MONTH_LEFT":
      return `Gói ${pkg} của ${clientName} chỉ còn 1 tháng — hết hạn ${formatDate(p.endDate)}${daysLeft != null ? ` (còn ${daysLeft} ngày)` : ""}, mới tập ${progress}.`;
    case "DAYS_2_WEEKS_LEFT":
      return `Gói ${pkg} của ${clientName} chỉ còn 2 tuần — hết hạn ${formatDate(p.endDate)}${daysLeft != null ? ` (còn ${daysLeft} ngày)` : ""}, mới tập ${progress}.`;
  }
}

/** FM phụ trách từng cơ sở: theo phân công fm_branch_assignments, và theo cơ sở
 *  ghi thẳng trên hồ sơ nhân sự cho FM chưa được phân công bảng riêng. */
async function fmsByBranch(): Promise<Map<string, string[]>> {
  const [assignments, fms] = await Promise.all([
    prisma.fMBranchAssignment.findMany({
      where: { user: { role: "FM", deletedAt: null } },
      select: { userId: true, branchId: true },
    }),
    prisma.user.findMany({
      where: { role: "FM", deletedAt: null, branchId: { not: null } },
      select: { id: true, branchId: true },
    }),
  ]);

  const map = new Map<string, Set<string>>();
  const add = (branchId: string, userId: string) => {
    const set = map.get(branchId) ?? new Set<string>();
    set.add(userId);
    map.set(branchId, set);
  };
  for (const a of assignments) add(a.branchId, a.userId);
  for (const f of fms) if (f.branchId) add(f.branchId, f.id);

  return new Map(Array.from(map, ([branchId, set]) => [branchId, Array.from(set)]));
}

/**
 * Quét các lộ trình đang chạy và tạo thông báo cho những mốc vừa đạt.
 * Truyền `clientId` để chỉ quét một khách (gọi ngay sau khi trừ buổi lúc
 * check-in, cho mốc số buổi hiện ngay thay vì đợi cron sáng hôm sau).
 */
export async function generatePackageProgressNotifications(opts?: {
  clientId?: string;
  now?: Date;
}): Promise<{ created: number; scanned: number }> {
  const now = opts?.now ?? new Date();

  const enrollments = await prisma.packageEnrollment.findMany({
    where: { status: "ACTIVE", ...(opts?.clientId ? { clientId: opts.clientId } : {}) },
    select: {
      id: true,
      clientId: true,
      packageName: true,
      sessions: true,
      sessionsUsed: true,
      startDate: true,
      endDate: true,
      durationDays: true,
      reservedDays: true,
      extensionDays: true,
      client: { select: { fullName: true, branchId: true } },
    },
  });
  if (enrollments.length === 0) return { created: 0, scanned: 0 };

  // Mốc đã gửi rồi — xét theo LỘ TRÌNH (không theo từng FM) để FM mới được phân
  // công không bị dội lại toàn bộ mốc cũ của khách.
  const sent = await prisma.packageProgressNotification.findMany({
    where: { enrollmentId: { in: enrollments.map((e) => e.id) } },
    select: { enrollmentId: true, milestone: true },
    distinct: ["enrollmentId", "milestone"],
  });
  const sentByEnrollment = new Map<string, ProgressMilestone[]>();
  for (const s of sent) {
    const list = sentByEnrollment.get(s.enrollmentId) ?? [];
    list.push(s.milestone as ProgressMilestone);
    sentByEnrollment.set(s.enrollmentId, list);
  }

  const branchFMs = await fmsByBranch();

  const rows: {
    userId: string;
    clientId: string;
    enrollmentId: string;
    milestone: ProgressMilestone;
    message: string;
  }[] = [];

  for (const e of enrollments) {
    // Gói ACTIVE nhưng đã quá hạn (cron đóng gói chưa kịp chạy) thì không nhắc
    // nữa — báo "sắp hết hạn" cho một lộ trình đã hết là vô nghĩa với FM.
    if (e.endDate != null && e.endDate < now) continue;

    const fmIds = branchFMs.get(e.client.branchId) ?? [];
    if (fmIds.length === 0) continue;

    const already = sentByEnrollment.get(e.id) ?? [];
    const reached: (ProgressMilestone | null)[] = [
      reachedSessionMilestone(e),
      reachedDayMilestone(e, now),
    ];

    for (const milestone of reached) {
      if (!milestone) continue;
      // Đã gửi mốc bằng hoặc cao hơn trên cùng trục thì thôi.
      const track = TRACK_OF[milestone];
      const passed = already.some(
        (m) => TRACK_OF[m] === track && RANK_OF[m] >= RANK_OF[milestone]
      );
      if (passed) continue;

      const message = buildMessage(milestone, e.client.fullName, e, now);
      for (const userId of fmIds) {
        rows.push({ userId, clientId: e.clientId, enrollmentId: e.id, milestone, message });
      }
    }
  }

  if (rows.length === 0) return { created: 0, scanned: enrollments.length };

  const res = await prisma.packageProgressNotification.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return { created: res.count, scanned: enrollments.length };
}
