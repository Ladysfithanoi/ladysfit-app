import { prisma } from "@/lib/prisma";
import { refreshClientChurnStatus, isPackageOngoing } from "@/lib/client-status";

export type PackageUpdate = {
  id: string;
  sessionsUsed: number;
  sessions: number;
  packageName: string;
  status: string;
};

// Hard cap on a single session's length. A session checked in but never checked
// out within this window is considered abandoned: the PT can no longer get a
// legitimate check-out signature, so it must NOT count toward the PT's salary.
export const MAX_SESSION_MINUTES = 120;

// Reason stamped on auto-voided over-cap sessions.
export const OVER_CAP_VOID_REASON =
  "Quá 2 tiếng chưa ký check-out — tự động huỷ buổi (không hoàn buổi cho khách)";

// Void every IN_PROGRESS session that has run past the 2-hour cap without a
// check-out. Voiding (not deleting) means:
//   • the buổi dạy does NOT count for the PT's salary (only COMPLETED counts);
//   • the package buổi is NOT refunded — the client already signed the check-in,
//     so the deduction stands (we deliberately do not call reversePackageSession);
//   • the record + check-in signature are kept for the history.
// Returns how many sessions were voided. Safe to call repeatedly (already-voided
// rows no longer match the filter).
export async function voidOverCapSessions(): Promise<number> {
  const threshold = new Date(Date.now() - MAX_SESSION_MINUTES * 60_000);
  const { count } = await prisma.workoutLog.updateMany({
    where: { status: "IN_PROGRESS", checkInAt: { lt: threshold } },
    data: { status: "VOID", voidReason: OVER_CAP_VOID_REASON },
  });
  return count;
}

// Những buổi (WorkoutSession) đã có ít nhất một nhật ký tập.
//
// WorkoutLog.session là onDelete: Cascade, nên xoá một buổi sẽ xoá luôn nhật ký,
// chữ ký check-in / check-out và toàn bộ số liệu set của khách — không thể khôi
// phục. Mọi thao tác ĐỒNG BỘ CẤU TRÚC giáo án (lưu giáo án tuần, đổi số buổi/tuần)
// phải gọi hàm này trước và tuyệt đối không xoá các buổi nằm trong tập trả về.
// Chỉ những thao tác XOÁ CÓ CHỦ ĐÍCH (xoá hẳn 1 buổi) mới được đụng tới chúng, và
// phải hoàn buổi cho lộ trình của khách.
export async function sessionIdsWithLogs(sessionIds: string[]): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();
  const rows = await prisma.workoutLog.findMany({
    where: { sessionId: { in: sessionIds } },
    select: { sessionId: true },
    distinct: ["sessionId"],
  });
  return new Set(rows.map((r) => r.sessionId));
}

// Deduct one session from the client's active package (buổi tập của khách).
// Called at CHECK-IN — the client's check-in signature is the proof they showed
// up, so the package advances even if the PT never completes the check-out.
//
// WHICH lộ trình is charged follows the gym's rule for a client holding several
// gói (e.g. they renewed before finishing the old one). A gói is chargeable only
// when it is BOTH còn hạn AND còn buổi:
//   • còn hạn  = đang ACTIVE và chưa quá endDate (endDate null = không đặt hạn →
//     coi như còn hạn). Dùng đúng định nghĩa isPackageOngoing như dashboard, nên
//     một gói ACTIVE đã quá hạn (dù còn buổi) sẽ KHÔNG bị trừ.
//   • còn buổi = sessionsUsed < sessions. Gói đã hết buổi (dù còn hạn) cũng không
//     bị trừ.
// Trong các gói hợp lệ, trừ gói CÒN HẠN CŨ NHẤT trước (oldest createdAt) — dùng
// xong gói cũ rồi mới sang gói mới. Nếu không có gói hợp lệ nào thì không trừ
// (trả null) — buổi vẫn được ghi nhận nhưng không trừ vào lộ trình nào.
export async function countPackageSession(clientId: string): Promise<PackageUpdate | null> {
  const now = new Date();
  const candidates = await prisma.packageEnrollment.findMany({
    where: { clientId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" }, // oldest → newest
  });

  // Oldest gói that is còn hạn AND còn buổi.
  const activePackage =
    candidates.find((p) => isPackageOngoing(p, now) && p.sessionsUsed < p.sessions) ?? null;
  if (!activePackage) return null;

  const newSessionsUsed = activePackage.sessionsUsed + 1;
  const newStatus = newSessionsUsed >= activePackage.sessions ? "COMPLETED" : "ACTIVE";
  const updated = await prisma.packageEnrollment.update({
    where: { id: activePackage.id },
    data: { sessionsUsed: newSessionsUsed, status: newStatus },
  });

  // Hết buổi: nếu gói vừa hoàn thành và khách không còn lộ trình nào khác
  // đang chạy thì chuyển trạng thái khách sang "Nghỉ tập".
  if (newStatus === "COMPLETED") {
    await refreshClientChurnStatus(clientId);
  }

  return {
    id: updated.id,
    sessionsUsed: updated.sessionsUsed,
    sessions: updated.sessions,
    packageName: updated.packageName,
    status: updated.status,
  };
}

// Reverse one session on the client's package — used when a counted session is
// deleted or voided so the client isn't charged for a session that didn't count.
// Pass the exact package the session was charged against (log.packageEnrollmentId)
// so the refund lands on the same lộ trình; falls back to the most-recently
// charged package for legacy logs recorded before that id was tracked.
export async function reversePackageSession(
  clientId: string,
  packageEnrollmentId?: string | null
): Promise<PackageUpdate | null> {
  let pkg = packageEnrollmentId
    ? await prisma.packageEnrollment.findFirst({
        where: { id: packageEnrollmentId, clientId, sessionsUsed: { gt: 0 } },
      })
    : null;
  if (!pkg) {
    pkg = await prisma.packageEnrollment.findFirst({
      where: { clientId, status: { in: ["ACTIVE", "COMPLETED"] }, sessionsUsed: { gt: 0 } },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!pkg) return null;

  const updated = await prisma.packageEnrollment.update({
    where: { id: pkg.id },
    data: { sessionsUsed: pkg.sessionsUsed - 1, status: "ACTIVE" },
  });
  return {
    id: updated.id,
    sessionsUsed: updated.sessionsUsed,
    sessions: updated.sessions,
    packageName: updated.packageName,
    status: updated.status,
  };
}

// Create the client-facing "session complete → next session" notification.
// Called at CHECK-OUT (when the session is actually finished). Best-effort.
export async function notifyNextSession(
  clientId: string,
  log: { id: string; sessionId: string; programId: string; weekId: string }
): Promise<void> {
  try {
    const [client, program] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId }, select: { fullName: true } }),
      prisma.workoutProgram.findUnique({
        where: { id: log.programId },
        select: {
          phase: true,
          weeks: {
            orderBy: { weekNumber: "asc" },
            include: { sessions: { orderBy: { order: "asc" }, select: { id: true, order: true } } },
          },
          sessions: {
            where: { weekId: null },
            orderBy: { order: "asc" },
            select: { id: true, order: true },
          },
        },
      }),
    ]);

    if (client && program) {
      const phase = program.phase;
      // Buổi được đánh số liên tục qua các tuần (Buổi 1, 2, 3 …): số của một buổi =
      // tổng số buổi các tuần trước + vị trí trong tuần hiện tại.
      const currentWeek = program.weeks.find((w) => w.id === log.weekId) ?? null;
      const allSessions = currentWeek?.sessions.length ? currentWeek.sessions : program.sessions;
      const base = currentWeek
        ? program.weeks
            .filter((w) => w.weekNumber < currentWeek.weekNumber)
            .reduce((sum, w) => sum + w.sessions.length, 0)
        : 0;
      const foundIdx = allSessions.findIndex((s) => s.id === log.sessionId);
      const currentIdx = foundIdx >= 0 ? foundIdx : 0;
      const nextIdx = currentIdx < allSessions.length - 1 ? currentIdx + 1 : 0;
      const currentLabel = `Buổi ${base + currentIdx + 1}`;
      const nextLabel = `Buổi ${base + nextIdx + 1}`;

      await prisma.workoutNotification.create({
        data: {
          clientId,
          workoutLogId: log.id,
          message: `Chúc mừng chị ${client.fullName} đã hoàn thành ${currentLabel} - ${phase}. Buổi tập tiếp theo của chị sẽ là ${nextLabel} - ${phase}`,
          nextSessionName: nextLabel,
          nextSessionPhase: phase,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }
  } catch {
    // ignore — notification is best-effort
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeWorkoutLog(log: any) {
  return {
    ...log,
    sessionDate: log.sessionDate?.toISOString?.() ?? log.sessionDate,
    createdAt: log.createdAt?.toISOString?.() ?? log.createdAt,
    checkInAt: log.checkInAt?.toISOString?.() ?? null,
    checkOutAt: log.checkOutAt?.toISOString?.() ?? null,
    firstInteractionAt: log.firstInteractionAt?.toISOString?.() ?? null,
    confirmedAt: log.confirmedAt?.toISOString?.() ?? null,
  };
}

// ── Set 1 chuẩn bị trước ↔ Set 1 trong nhật ký ──────────────────────────────
//
// Nhân sự điền trước Reps/Mức tạ của Set 1 ngay trong giáo án (WorkoutMovement
// .plannedLoad/.plannedReps) để buổi tập đã sẵn sàng trước khi khách đến. Đây
// KHÔNG phải một ô riêng chạy song song với Set 1 của nhật ký — nó chính là Set
// 1, chỉ nhập sớm hơn:
//   • Lúc check-in, giá trị chuẩn bị được đổ thẳng vào Set 1 của nhật ký. Nhờ vậy
//     phần điền sẵn tự động theo tuần trước (chỉ điền khi Set 1 còn TRỐNG) không
//     bao giờ đè lên thứ nhân sự đã chuẩn bị tay.
//   • Sửa Set 1 trong nhật ký thì ghi ngược lại giáo án bằng hàm dưới đây, để mở
//     lại buổi tập vẫn thấy đúng con số mới nhất.

/** Chuỗi rỗng/space coi như chưa nhập, để hai bên so sánh được với nhau. */
function normalizeSetValue(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Chiều nhật ký → giáo án: đẩy Set 1 vừa nhập về `plannedLoad`/`plannedReps` của
 * chuyển động tương ứng. Chỉ ghi những dòng THỰC SỰ đổi (autosave chạy mỗi ~1.2s
 * nên ghi hết mọi dòng mỗi lần là phí).
 */
export async function syncPlannedSetsFromLog(
  setLogs: { id: string; set1Load?: string | null; set1Reps?: string | null }[]
): Promise<void> {
  if (setLogs.length === 0) return;

  const rows = await prisma.workoutSetLog.findMany({
    where: { id: { in: setLogs.map((s) => s.id) } },
    select: {
      id: true,
      movementId: true,
      movement: { select: { plannedLoad: true, plannedReps: true } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const jobs: Promise<unknown>[] = [];
  for (const sl of setLogs) {
    const row = byId.get(sl.id);
    // Nhật ký cũ có thể mất liên kết chuyển động (movementId = null khi giáo án
    // bị sửa) — không có chỗ nào để ghi về thì bỏ qua.
    if (!row?.movementId || !row.movement) continue;
    const load = normalizeSetValue(sl.set1Load);
    const reps = normalizeSetValue(sl.set1Reps);
    if (row.movement.plannedLoad === load && row.movement.plannedReps === reps) continue;
    jobs.push(
      prisma.workoutMovement.update({
        where: { id: row.movementId },
        data: { plannedLoad: load, plannedReps: reps },
      })
    );
  }
  await Promise.all(jobs);
}
