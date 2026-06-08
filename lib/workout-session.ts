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
export async function countPackageSession(clientId: string): Promise<PackageUpdate | null> {
  const activePackage = await prisma.packageEnrollment.findFirst({
    where: { clientId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
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
export async function reversePackageSession(clientId: string): Promise<PackageUpdate | null> {
  const pkg = await prisma.packageEnrollment.findFirst({
    where: { clientId, status: { in: ["ACTIVE", "COMPLETED"] }, sessionsUsed: { gt: 0 } },
    orderBy: { createdAt: "desc" },
  });
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
