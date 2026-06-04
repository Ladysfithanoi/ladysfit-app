import { prisma } from "@/lib/prisma";
import { refreshClientChurnStatus } from "@/lib/client-status";

export type PackageUpdate = {
  id: string;
  sessionsUsed: number;
  sessions: number;
  packageName: string;
  status: string;
};

// Increment sessionsUsed on the active package and create the client-facing
// "session complete" notification. Shared by the signature check-out path and
// the client-app confirmation path so a session is counted in exactly one place.
export async function incrementPackageAndNotify(
  clientId: string,
  log: { id: string; sessionId: string; programId: string; weekId: string }
): Promise<PackageUpdate | null> {
  let packageUpdate: PackageUpdate | null = null;

  const activePackage = await prisma.packageEnrollment.findFirst({
    where: { clientId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (activePackage) {
    const newSessionsUsed = activePackage.sessionsUsed + 1;
    const newStatus = newSessionsUsed >= activePackage.sessions ? "COMPLETED" : "ACTIVE";
    const updated = await prisma.packageEnrollment.update({
      where: { id: activePackage.id },
      data: { sessionsUsed: newSessionsUsed, status: newStatus },
    });
    packageUpdate = {
      id: updated.id,
      sessionsUsed: updated.sessionsUsed,
      sessions: updated.sessions,
      packageName: updated.packageName,
      status: updated.status,
    };

    // Hết buổi: nếu gói vừa hoàn thành và khách không còn lộ trình nào khác
    // đang chạy thì chuyển trạng thái khách sang "Nghỉ tập".
    if (newStatus === "COMPLETED") {
      await refreshClientChurnStatus(clientId);
    }
  }

  // Completion notification for the client (non-critical).
  try {
    const [client, currentSession, program] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId }, select: { fullName: true } }),
      prisma.workoutSession.findUnique({ where: { id: log.sessionId }, select: { sessionName: true, order: true } }),
      prisma.workoutProgram.findUnique({
        where: { id: log.programId },
        select: {
          phase: true,
          weeks: {
            where: { id: log.weekId },
            include: { sessions: { orderBy: { order: "asc" }, select: { sessionName: true, order: true } } },
          },
          sessions: {
            where: { weekId: null },
            orderBy: { order: "asc" },
            select: { sessionName: true, order: true },
          },
        },
      }),
    ]);

    if (client && currentSession && program) {
      const phase = program.phase;
      const allSessions = program.weeks[0]?.sessions.length
        ? program.weeks[0].sessions
        : program.sessions;
      const currentIdx = allSessions.findIndex((s) => s.order === currentSession.order);
      const nextSession =
        currentIdx >= 0 && currentIdx < allSessions.length - 1
          ? allSessions[currentIdx + 1]
          : allSessions[0];
      const currentLabel = currentSession.sessionName.split("—")[0].trim();
      const nextLabel = nextSession?.sessionName.split("—")[0].trim() ?? currentLabel;

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

  return packageUpdate;
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
