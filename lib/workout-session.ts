import { prisma } from "@/lib/prisma";
import { refreshClientChurnStatus } from "@/lib/client-status";

export type PackageUpdate = {
  id: string;
  sessionsUsed: number;
  sessions: number;
  packageName: string;
  status: string;
};

// Deduct one session from the client's active package (buổi tập của khách).
// Called at CHECK-IN — the client's check-in signature is the proof they showed
// up, so the package advances even if the PT never completes the check-out.
//
// WHICH lộ trình is charged is resolved from the workout PROGRAM the session
// belongs to, NOT a blind global rule — a client can hold several ACTIVE gói at
// once (e.g. they renewed before finishing the old one). We resolve the target
// package, in order:
//   1. the program's explicit package link (program.packageEnrollmentId), if that
//      package still has sessions left;
//   2. continuity — the package this same program's PREVIOUS sessions were charged
//      against (WorkoutLog.packageEnrollmentId), if it still has room. This keeps
//      a client who is finishing an OLD program depleting the OLD gói even after
//      an early renewal added a newer gói;
//   3. default for a brand-new program with no history — the NEWEST ACTIVE gói
//      with room (the one bought alongside it), so a client training a new program
//      depletes the new gói, not an older leftover one;
//   4. final fallbacks: oldest ACTIVE gói with room, then any active gói.
// Once resolved for a program that had no link yet, the program is bound to that
// gói so every later session of it charges the same lộ trình.
export async function countPackageSession(
  clientId: string,
  programId?: string | null
): Promise<PackageUpdate | null> {
  const activePackages = await prisma.packageEnrollment.findMany({
    where: { clientId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" }, // oldest → newest
  });
  if (activePackages.length === 0) return null;

  const withRoom = activePackages.filter((p) => p.sessionsUsed < p.sessions);
  const newestWithRoom = withRoom.length > 0 ? withRoom[withRoom.length - 1] : null;

  let target: (typeof activePackages)[number] | null = null;
  let program: { packageEnrollmentId: string | null } | null = null;
  if (programId) {
    program = await prisma.workoutProgram.findUnique({
      where: { id: programId },
      select: { packageEnrollmentId: true },
    });
    if (program) {
      // 1) explicit program → package link (only if it still has room)
      const linkedId = program.packageEnrollmentId;
      if (linkedId) {
        target = withRoom.find((p) => p.id === linkedId) ?? null;
      }
      // 2) continuity: the gói this program's earlier sessions already charged
      if (!target) {
        const prior = await prisma.workoutLog.findFirst({
          where: { programId, packageEnrollmentId: { not: null } },
          orderBy: { createdAt: "desc" },
          select: { packageEnrollmentId: true },
        });
        if (prior?.packageEnrollmentId) {
          target = withRoom.find((p) => p.id === prior.packageEnrollmentId) ?? null;
        }
      }
      // 3) brand-new program → newest ACTIVE gói with room
      if (!target) target = newestWithRoom;
    }
  }

  // 4) final fallbacks for unresolved/legacy: oldest with room, then any active.
  const activePackage = target ?? withRoom[0] ?? activePackages[0];
  if (!activePackage) return null;

  const newSessionsUsed = activePackage.sessionsUsed + 1;
  const newStatus = newSessionsUsed >= activePackage.sessions ? "COMPLETED" : "ACTIVE";
  const updated = await prisma.packageEnrollment.update({
    where: { id: activePackage.id },
    data: { sessionsUsed: newSessionsUsed, status: newStatus },
  });

  // Bind the program to the gói it charged so later sessions stay consistent
  // (also fixes per-lộ-trình salary/photo grouping). Only set it when missing.
  if (programId && program && !program.packageEnrollmentId) {
    await prisma.workoutProgram.update({
      where: { id: programId },
      data: { packageEnrollmentId: activePackage.id },
    });
  }

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
