import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { PortalLayoutClient } from "@/components/my/portal-layout-client";
import { ActivityTab } from "@/components/my/activity-tab";
import { ensureClientPhaseProgression } from "@/lib/phase-progression";

export default async function ActivityPage() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) redirect("/my/login");

  const clientId = session.user.id;

  // Cập nhật tiến trình giai đoạn trước khi đọc CT đang áp dụng, để khách chỉ
  // thấy đúng giai đoạn hiện tại.
  await ensureClientPhaseProgression(clientId);

  const [client, activityLogs, program, rawWorkoutLogs, rawPending, rawLive] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { fullName: true, avatarUrl: true } }),
    prisma.activityLog.findMany({ where: { clientId }, orderBy: { date: "desc" }, take: 30 }),
    prisma.workoutProgram.findFirst({
      where: { clientId, status: "ACTIVE" },
      include: {
        weeks: {
          orderBy: { weekNumber: "asc" },
          include: {
            sessions: {
              orderBy: { order: "asc" },
              include: { movements: { orderBy: { order: "asc" } } },
            },
          },
        },
        sessions: {
          where: { weekId: null },
          orderBy: { order: "asc" },
          include: { movements: { orderBy: { order: "asc" } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workoutLog.findMany({
      where: { clientId, status: "COMPLETED" },
      include: {
        session: { select: { sessionName: true } },
        program: { select: { workoutType: true } },
        setLogs: { orderBy: { id: "asc" } },
        createdBy: { select: { name: true } },
      },
      orderBy: { sessionDate: "desc" },
      take: 30,
    }),
    // Sessions the PT finished that are waiting for THIS client to confirm.
    prisma.workoutLog.findMany({
      where: { clientId, status: "AWAITING_CONFIRMATION" },
      include: {
        session: { select: { sessionName: true } },
        program: { select: { phase: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { checkOutAt: "desc" },
    }),
    // Sessions currently in progress (PT checked in, not yet checked out) — the
    // client can approve ending these early.
    prisma.workoutLog.findMany({
      where: { clientId, status: "IN_PROGRESS" },
      include: {
        session: { select: { sessionName: true } },
        program: { select: { phase: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { checkInAt: "desc" },
    }),
  ]);

  if (!client) redirect("/my/login");

  const pendingConfirmations = rawPending.map((l) => ({
    id: l.id,
    sessionName: l.session.sessionName,
    phase: l.program.phase,
    ptName: l.createdBy.name ?? null,
    checkInAt: l.checkInAt?.toISOString() ?? null,
    checkOutAt: l.checkOutAt?.toISOString() ?? null,
  }));

  const liveSessions = rawLive.map((l) => ({
    id: l.id,
    sessionName: l.session.sessionName,
    phase: l.program.phase,
    ptName: l.createdBy.name ?? null,
    checkInAt: l.checkInAt?.toISOString() ?? null,
    earlyEndApprovedAt: l.earlyEndApprovedAt?.toISOString() ?? null,
  }));

  const serializedLogs = activityLogs.map((l) => ({
    id: l.id,
    date: l.date.toISOString(),
    steps: l.steps,
    minutesActive: l.minutesActive,
    minutesGym: l.minutesGym,
    note: l.note,
  }));

  // Determine which sessions to show: current week's sessions, or legacy sessions
  let portalSessions: {
    id: string;
    sessionName: string;
    order: number;
    movements: { id: string; movementName: string; selectedExercise: string; sets: number; reps: string; order: number }[];
  }[] = [];
  let currentWeek = 1;
  let phase = "";
  let workoutType: string | null = null;
  let sessionsPerWeek = 0;

  if (program) {
    phase = program.phase;
    workoutType = program.workoutType ?? null;
    sessionsPerWeek = program.sessionsPerWeek;
    currentWeek = program.currentWeek;

    if (program.weeks.length > 0) {
      const activeWeek =
        program.weeks.find((w) => w.weekNumber === program.currentWeek) ??
        program.weeks[program.weeks.length - 1];
      portalSessions = activeWeek.sessions.map((s) => ({
        id: s.id,
        sessionName: s.sessionName,
        order: s.order,
        movements: s.movements.map((m) => ({
          id: m.id,
          movementName: m.movementName,
          selectedExercise: m.selectedExercise,
          sets: m.sets,
          reps: m.reps,
          order: m.order,
        })),
      }));
    } else {
      // Legacy: no weeks
      portalSessions = program.sessions.map((s) => ({
        id: s.id,
        sessionName: s.sessionName,
        order: s.order,
        movements: s.movements.map((m) => ({
          id: m.id,
          movementName: m.movementName,
          selectedExercise: m.selectedExercise,
          sets: m.sets,
          reps: m.reps,
          order: m.order,
        })),
      }));
    }
  }

  const workoutLogs = rawWorkoutLogs.map((l) => ({
    id: l.id,
    sessionDate: l.sessionDate.toISOString(),
    sessionName: l.session.sessionName,
    workoutType: l.program.workoutType ?? null,
    notes: l.notes,
    createdByName: l.createdBy.name ?? null,
    setLogs: l.setLogs.map((sl) => ({
      id: sl.id,
      movementName: sl.movementName,
      exerciseName: sl.exerciseName,
      set1Load: sl.set1Load, set1Reps: sl.set1Reps,
      set2Load: sl.set2Load, set2Reps: sl.set2Reps,
      set3Load: sl.set3Load, set3Reps: sl.set3Reps,
      set4Load: sl.set4Load, set4Reps: sl.set4Reps,
      set5Load: sl.set5Load, set5Reps: sl.set5Reps,
      set6Load: sl.set6Load, set6Reps: sl.set6Reps,
      exerciseNotes: sl.exerciseNotes,
    })),
  }));

  const portalProgram = program
    ? {
        id: program.id,
        phase,
        workoutType,
        sessionsPerWeek,
        currentWeek,
        notes: program.notes,
        sessions: portalSessions,
      }
    : null;

  return (
    <PortalLayoutClient clientName={client.fullName} avatarUrl={client.avatarUrl}>
      <ActivityTab
        activityLogs={serializedLogs}
        workoutProgram={portalProgram}
        workoutLogs={workoutLogs}
        pendingConfirmations={pendingConfirmations}
        liveSessions={liveSessions}
      />
    </PortalLayoutClient>
  );
}
